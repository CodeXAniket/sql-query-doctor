import type { Detection, Rule } from "../types";
import { scan } from "../scan";

/* -------------------------------------------------------------------------
   R08 — NOT IN (subquery)
   ------------------------------------------------------------------------- */
export const notInSubquery: Rule = {
  id: "not-in-subquery",
  title: "NOT IN (subquery)",
  category: "anti-join",
  severity: "high",
  summary: "NOT IN over a subquery is slow and breaks silently when the subquery returns NULL.",
  explanation:
    "NOT IN with a subquery is evaluated as an anti-join but the planner often materializes " +
    "and rescans the subquery. Worse, if any value the subquery returns is NULL, the whole " +
    "predicate becomes UNKNOWN and the query returns zero rows — a correctness trap.",
  suggestion:
    "Use NOT EXISTS (correlated) or a LEFT JOIN ... WHERE right.key IS NULL. Both are " +
    "NULL-safe and let the planner pick an efficient anti-join.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\bnot\s+in\s*\(\s*select\b/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "NOT IN (subquery) — prefer NOT EXISTS or an anti-join (NULL-unsafe).",
      });
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R09 — IN (subquery)
   ------------------------------------------------------------------------- */
export const inSubquery: Rule = {
  id: "in-subquery",
  title: "IN (subquery)",
  category: "anti-join",
  severity: "medium",
  summary: "IN (subquery) can materialize the inner result; EXISTS or a JOIN is often faster.",
  explanation:
    "Some planners execute IN (SELECT ...) by building and scanning the full subquery result " +
    "for each check instead of using a semi-join, especially with older engines or when the " +
    "subquery is correlated.",
  suggestion:
    "Rewrite as EXISTS (SELECT 1 ... WHERE ...) for a semi-join, or as an explicit JOIN when " +
    "you need columns from the other table. Verify with EXPLAIN.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /(?<!\bnot\s)\bin\s*\(\s*select\b/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "IN (subquery) — consider EXISTS or a JOIN.",
      });
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R10 — Scalar / correlated subquery in the SELECT list
   ------------------------------------------------------------------------- */
export const scalarSubqueryInSelect: Rule = {
  id: "scalar-subquery-in-select",
  title: "Subquery in the SELECT list",
  category: "anti-join",
  severity: "medium",
  summary: "A subquery per output column often runs once per row — the SQL equivalent of N+1.",
  explanation:
    "A correlated subquery in the SELECT list is re-evaluated for every row of the outer " +
    "query. On a large result set this multiplies work and is the classic N+1 pattern " +
    "expressed in SQL.",
  suggestion:
    "Convert the scalar subquery into a JOIN (often a LEFT JOIN to a grouped derived table) " +
    "so the value is computed once per group and merged in a single pass.",
  detect(ctx) {
    const out: Detection[] = [];
    // Look at the SELECT ... FROM span of each statement and find "(select" in it.
    const selectRe = /\bselect\b/gi;
    let sm: RegExpExecArray | null;
    while ((sm = selectRe.exec(ctx.lower)) !== null) {
      const fromRel = ctx.lower.slice(sm.index).search(/\bfrom\b/);
      if (fromRel === -1) continue;
      const listStart = sm.index + sm[0].length;
      const listEnd = sm.index + fromRel;
      const list = ctx.lower.slice(listStart, listEnd);
      const inner = /\(\s*select\b/gi;
      let im: RegExpExecArray | null;
      while ((im = inner.exec(list)) !== null) {
        out.push({
          index: listStart + im.index,
          length: im[0].length,
          message: "Subquery in the SELECT list is evaluated per row — fold it into a JOIN.",
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R11 — Implicit cross join (comma-separated tables)
   ------------------------------------------------------------------------- */
export const implicitCrossJoin: Rule = {
  id: "implicit-cross-join",
  title: "Comma join / implicit cross join",
  category: "full-scan",
  severity: "high",
  summary: "Comma-separated tables in FROM produce a Cartesian product if a link is missed.",
  explanation:
    "Old-style FROM a, b relies on a WHERE clause to supply the join condition. If that " +
    "condition is missing or wrong, the database builds the full Cartesian product — every " +
    "row of a paired with every row of b — which explodes combinatorially.",
  suggestion:
    "Use explicit JOIN ... ON syntax so the join condition is required and visible, e.g. " +
    "FROM a JOIN b ON a.id = b.a_id.",
  detect(ctx) {
    const out: Detection[] = [];
    // FROM <ident> [alias] , <ident> ...  (comma at depth 0 within a FROM list)
    const fromRe = /\bfrom\b/gi;
    let m: RegExpExecArray | null;
    while ((m = fromRe.exec(ctx.lower)) !== null) {
      const start = m.index + m[0].length;
      let depth = 0;
      for (let i = start; i < ctx.lower.length; i++) {
        const c = ctx.lower[i];
        if (c === "(") depth++;
        else if (c === ")") {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0) {
          const rest = ctx.lower.slice(i);
          if (/^\b(where|group\s+by|order\s+by|limit|having|union|join|on|;)/.test(rest)) break;
          if (c === ";") break;
          if (c === ",") {
            out.push({
              index: i,
              length: 1,
              message: "Comma join can create a Cartesian product — use explicit JOIN ... ON.",
            });
            break; // one report per FROM is enough
          }
        }
      }
    }
    // Explicit CROSS JOIN is also worth flagging.
    for (const { match } of scan(ctx, /\bcross\s+join\b/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "CROSS JOIN produces a Cartesian product; confirm this is intentional.",
      });
    }
    return out;
  },
};
