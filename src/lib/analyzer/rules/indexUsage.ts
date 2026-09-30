import type { Detection, Rule, SqlContext } from "../types";
import { scan, whereRegions, inWhereOrOn } from "../scan";

/**
 * Starting at `from` (an offset just past a keyword), skip whitespace and, if a
 * single-quoted string literal follows, return its unquoted value and the
 * offset just past its closing quote. Reads from raw so the literal's real
 * contents (blanked in the mask) are available.
 */
function readFollowingLiteral(
  ctx: SqlContext,
  from: number,
): { value: string; end: number } | null {
  let p = from;
  while (p < ctx.raw.length && /\s/.test(ctx.raw[p])) p++;
  if (ctx.raw[p] !== "'") return null;
  const close = ctx.raw.indexOf("'", p + 1);
  return {
    value: ctx.raw.slice(p + 1, close === -1 ? undefined : close),
    end: close === -1 ? ctx.raw.length : close + 1,
  };
}

/* -------------------------------------------------------------------------
   R01 — Leading-wildcard LIKE
   ------------------------------------------------------------------------- */
export const leadingWildcardLike: Rule = {
  id: "leading-wildcard-like",
  title: "Leading-wildcard LIKE",
  category: "index-usage",
  severity: "high",
  summary: "A LIKE / ILIKE pattern that begins with % or _ cannot use a B-tree index.",
  explanation:
    "A pattern such as '%term' forces the database to test every row, because a " +
    "B-tree index is ordered by the start of the value. The engine falls back to a " +
    "full table (or index) scan, so the query cost grows linearly with table size.",
  suggestion:
    "Anchor the pattern to the start (col LIKE 'term%') so the index range-scans. " +
    "For genuine substring/contains search use a trigram index (PostgreSQL pg_trgm), " +
    "a full-text index, or a dedicated search engine.",
  detect(ctx) {
    const out: Detection[] = [];
    // Find the LIKE keyword on the masked text (so LIKE inside comments/strings
    // is ignored), then read the following literal from raw.
    for (const { match } of scan(ctx, /\b(?:not\s+)?i?like\b/gi)) {
      const lit = readFollowingLiteral(ctx, match.index + match[0].length);
      if (!lit) continue;
      if (lit.value.startsWith("%") || lit.value.startsWith("_")) {
        out.push({
          index: match.index,
          length: lit.end - match.index,
          message: `Pattern '${lit.value}' has a leading wildcard, so no index can be used.`,
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R02 — Non-sargable function on a column
   ------------------------------------------------------------------------- */
const WRAPPING_FUNCS =
  "upper|lower|substr|substring|date|year|month|day|trunc|date_trunc|cast|convert|coalesce|left|right|trim|ltrim|rtrim|to_char|floor|ceil|round|abs|datediff|datepart";

export const nonSargableFunction: Rule = {
  id: "non-sargable-function",
  title: "Function wrapping an indexed column",
  category: "index-usage",
  severity: "high",
  summary: "Wrapping a column in a function inside WHERE/ON defeats an index on that column.",
  explanation:
    "When a column is passed through a function — UPPER(name), DATE(created_at), " +
    "CAST(id AS text) — the index stores the raw column value, not the function's " +
    "result, so the optimizer cannot use it and must compute the function for every row.",
  suggestion:
    "Rewrite the predicate so the bare column is on one side (e.g. created_at >= " +
    "'2024-01-01' AND created_at < '2024-02-01' instead of YEAR(created_at) = 2024), " +
    "or create a matching expression / functional index.",
  detect(ctx) {
    const out: Detection[] = [];
    const re = new RegExp(
      `\\b(${WRAPPING_FUNCS})\\s*\\([^()]*\\)\\s*(=|<>|!=|<=|>=|<|>|like|in|between)`,
      "gi",
    );
    for (const { match } of scan(ctx, re)) {
      if (!inWhereOrOn(ctx, match.index)) continue;
      out.push({
        index: match.index,
        length: match[0].length,
        message: `${match[1].toUpperCase()}(...) on a column prevents index use in this predicate.`,
      });
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R03 — Implicit type conversion (numeric column = quoted number)
   ------------------------------------------------------------------------- */
export const implicitConversion: Rule = {
  id: "implicit-conversion",
  title: "Implicit type conversion in predicate",
  category: "index-usage",
  severity: "medium",
  summary: "Comparing a column to a quoted number can trigger a cast that disables the index.",
  explanation:
    "A predicate like user_id = '42' compares a (likely numeric) column to a string. " +
    "The database resolves the type mismatch with an implicit cast; depending on which " +
    "side is cast, this can prevent the index on that column from being used and skews " +
    "row estimates.",
  suggestion:
    "Match the literal's type to the column (user_id = 42, not '42'), or bind a correctly " +
    "typed parameter. Confirm the column and comparison value share one type.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const region of whereRegions(ctx)) {
      // Read from raw so the quoted literal's digits are visible (mask blanks them).
      const body = ctx.raw.slice(region.start, region.end);
      const re = /\b([a-z_][a-z0-9_.]*)\s*(=|<>|!=|<=|>=|<|>)\s*'(\d+(?:\.\d+)?)'/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const abs = region.start + m.index;
        out.push({
          index: abs,
          length: m[0].length,
          message: `${m[1]} is compared to the quoted number '${m[3]}' — likely an implicit cast.`,
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R04 — OR chains in WHERE
   ------------------------------------------------------------------------- */
export const orInWhere: Rule = {
  id: "or-in-where",
  title: "OR chain in WHERE",
  category: "index-usage",
  severity: "medium",
  summary: "OR across predicates often forces the planner away from index range scans.",
  explanation:
    "An OR between conditions on different columns frequently cannot be satisfied by a " +
    "single index range, so the planner resorts to a full scan or an expensive " +
    "bitmap-OR of several indexes.",
  suggestion:
    "If the OR is over one column, use IN (...). If it spans columns, consider splitting " +
    "into UNION ALL of index-friendly queries, or add a composite/partial index.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const region of whereRegions(ctx)) {
      const body = ctx.lower.slice(region.start, region.end);
      const re = /\bor\b/gi;
      let m: RegExpExecArray | null;
      let first: number | null = null;
      let count = 0;
      while ((m = re.exec(body)) !== null) {
        if (first === null) first = m.index;
        count++;
      }
      if (first !== null && count >= 1) {
        out.push({
          index: region.start + first,
          length: 2,
          message:
            count === 1
              ? "OR in WHERE can block a single-index range scan."
              : `${count} OR conditions in WHERE — likely a full scan.`,
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R05 — Inequality (<> / !=) on a column
   ------------------------------------------------------------------------- */
export const inequalityOperator: Rule = {
  id: "inequality-operator",
  title: "Inequality operator on a column",
  category: "index-usage",
  severity: "low",
  summary: "!= / <> is non-sargable: the index cannot range-scan a 'not equal' predicate.",
  explanation:
    "A 'not equal' test matches almost every row, so even with an index the planner " +
    "usually chooses a full scan. It also can't be combined into a useful index range.",
  suggestion:
    "Where possible, express the intent positively (col IN (...) of the wanted values), " +
    "or ensure another selective predicate carries the index.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const region of whereRegions(ctx)) {
      const body = ctx.masked.slice(region.start, region.end);
      const re = /\b([a-z_][a-z0-9_.]*)\s*(<>|!=)\s*/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        out.push({
          index: region.start + m.index,
          length: m[0].trimEnd().length,
          message: `Inequality on ${m[1]} is non-sargable.`,
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R06 — LIKE with no wildcard
   ------------------------------------------------------------------------- */
export const likeNoWildcard: Rule = {
  id: "like-no-wildcard",
  title: "LIKE without a wildcard",
  category: "index-usage",
  severity: "low",
  summary: "A LIKE pattern with no % or _ is just equality — use = for clarity and speed.",
  explanation:
    "LIKE 'value' with no wildcard behaves like = but still invokes pattern-matching " +
    "machinery and, in some collations, blocks certain optimizations.",
  suggestion: "Replace LIKE 'value' with = 'value'.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\bi?like\b/gi)) {
      const lit = readFollowingLiteral(ctx, match.index + match[0].length);
      if (!lit) continue;
      if (!lit.value.includes("%") && !lit.value.includes("_")) {
        out.push({
          index: match.index,
          length: lit.end - match.index,
          message: `LIKE '${lit.value}' has no wildcard; use = instead.`,
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R07 — HAVING used for a non-aggregate filter
   ------------------------------------------------------------------------- */
export const havingWithoutAggregate: Rule = {
  id: "having-without-aggregate",
  title: "HAVING without an aggregate",
  category: "index-usage",
  severity: "low",
  summary: "Filtering a plain column in HAVING runs after grouping — move it to WHERE.",
  explanation:
    "HAVING is evaluated after rows are grouped and aggregated. Filtering on a " +
    "non-aggregated column there means the database groups rows it will immediately " +
    "discard, and it cannot use an index to pre-filter.",
  suggestion:
    "Move row-level conditions into WHERE so they filter before grouping and can use " +
    "an index; keep only aggregate conditions (e.g. COUNT(*) > 5) in HAVING.",
  detect(ctx) {
    const out: Detection[] = [];
    const re = /\bhaving\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ctx.lower)) !== null) {
      const start = m.index + m[0].length;
      // Grab up to the next clause keyword.
      const rest = ctx.lower.slice(start);
      const endRel = rest.search(/\b(order\s+by|limit|offset|union|except|intersect)\b/);
      const body = endRel === -1 ? rest : rest.slice(0, endRel);
      const hasAggregate = /\b(count|sum|avg|min|max|group_concat|string_agg|array_agg)\s*\(/i.test(
        body,
      );
      if (!hasAggregate && body.trim().length > 0) {
        out.push({
          index: m.index,
          length: m[0].length,
          message: "HAVING has no aggregate condition; this filter belongs in WHERE.",
        });
      }
    }
    return out;
  },
};
