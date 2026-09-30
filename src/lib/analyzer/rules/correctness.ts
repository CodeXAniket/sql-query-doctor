import type { Detection, Rule } from "../types";
import { scan } from "../scan";

/* -------------------------------------------------------------------------
   R18 — UPDATE / DELETE without WHERE
   ------------------------------------------------------------------------- */
export const missingWhereDml: Rule = {
  id: "missing-where-dml",
  title: "UPDATE / DELETE without WHERE",
  category: "correctness",
  severity: "critical",
  summary: "An UPDATE or DELETE with no WHERE rewrites or removes every row in the table.",
  explanation:
    "Without a WHERE clause the statement targets the entire table: DELETE empties it and " +
    "UPDATE rewrites every row. This is both catastrophic for data and maximally expensive, " +
    "taking a full-table write and often a long lock.",
  suggestion:
    "Add a WHERE clause that scopes the rows. If you truly mean the whole table, TRUNCATE is " +
    "the faster, explicit way to empty it — and review this in code review.",
  detect(ctx) {
    const out: Detection[] = [];
    // Split into statements on top-level semicolons, using masked text.
    const stmtRe = /(update|delete)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = stmtRe.exec(ctx.lower)) !== null) {
      const start = m.index;
      const semi = ctx.masked.indexOf(";", start);
      const end = semi === -1 ? ctx.masked.length : semi;
      const body = ctx.lower.slice(start, end);
      // DELETE must be "delete from"; ignore "delete" inside other contexts.
      if (m[1] === "delete" && !/^delete\s+from\b/.test(body)) continue;
      if (!/\bwhere\b/.test(body)) {
        out.push({
          index: start,
          length: m[0].length,
          message: `${m[1].toUpperCase()} without WHERE affects every row in the table.`,
        });
      }
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R19 — = NULL instead of IS NULL
   ------------------------------------------------------------------------- */
export const equalsNull: Rule = {
  id: "equals-null",
  title: "= NULL instead of IS NULL",
  category: "correctness",
  severity: "medium",
  summary: "Comparing to NULL with = / <> always yields UNKNOWN, so the row never matches.",
  explanation:
    "In SQL's three-valued logic, any comparison to NULL with = or <> evaluates to UNKNOWN, " +
    "which is treated as false in a WHERE clause. The predicate silently matches nothing, a " +
    "bug that produces empty results rather than an error.",
  suggestion: "Use IS NULL / IS NOT NULL to test for NULL.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /(=|<>|!=)\s*null\b/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "Comparison to NULL with = / <> never matches — use IS NULL / IS NOT NULL.",
      });
    }
    return out;
  },
};
