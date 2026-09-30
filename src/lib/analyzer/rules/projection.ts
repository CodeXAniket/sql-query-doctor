import type { Detection, Rule } from "../types";
import { scan } from "../scan";

/* -------------------------------------------------------------------------
   R12 — SELECT *
   ------------------------------------------------------------------------- */
export const selectStar: Rule = {
  id: "select-star",
  title: "SELECT *",
  category: "projection",
  severity: "medium",
  summary: "SELECT * reads every column, inflates I/O, and blocks covering-index-only scans.",
  explanation:
    "Selecting all columns transfers data you may not use, prevents the planner from " +
    "satisfying the query from a narrow covering index (forcing heap/row lookups), and " +
    "makes the query fragile to schema changes.",
  suggestion:
    "List only the columns you need. A tight column list can often be served entirely from " +
    "an index (index-only scan), avoiding table access altogether.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\bselect\s+(?:distinct\s+)?(?:[a-z_][a-z0-9_]*\.)?\*/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "SELECT * — project only the columns you need.",
      });
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R13 — SELECT DISTINCT
   ------------------------------------------------------------------------- */
export const selectDistinct: Rule = {
  id: "select-distinct",
  title: "SELECT DISTINCT",
  category: "projection",
  severity: "low",
  summary: "DISTINCT often hides a join that fans out rows; it forces a sort/hash to dedupe.",
  explanation:
    "DISTINCT makes the database sort or hash the entire result to remove duplicates. It is " +
    "frequently added to paper over a join that multiplies rows — fixing the join removes " +
    "both the duplicates and the dedupe cost.",
  suggestion:
    "Check whether a join is producing duplicates and constrain it (or use EXISTS / an " +
    "aggregate). Keep DISTINCT only when duplicates are genuinely expected.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\bselect\s+distinct\b/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "SELECT DISTINCT forces a dedupe pass — confirm a join isn't fanning out rows.",
      });
    }
    return out;
  },
};
