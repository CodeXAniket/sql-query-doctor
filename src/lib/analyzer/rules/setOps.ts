import type { Detection, Rule } from "../types";
import { scan } from "../scan";

/* -------------------------------------------------------------------------
   R17 — UNION instead of UNION ALL
   ------------------------------------------------------------------------- */
export const unionInsteadOfUnionAll: Rule = {
  id: "union-instead-of-union-all",
  title: "UNION instead of UNION ALL",
  category: "set-op",
  severity: "medium",
  summary: "UNION deduplicates with a sort/hash; use UNION ALL when duplicates are impossible.",
  explanation:
    "UNION removes duplicate rows, which requires the database to sort or hash the combined " +
    "result set. When the branches can't overlap (or duplicates are acceptable), that dedupe " +
    "pass is pure overhead.",
  suggestion:
    "Use UNION ALL unless you specifically need duplicate elimination. If you do need it, " +
    "make sure the columns involved are indexed to cheapen the sort.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\bunion\b(?!\s+all\b)/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "UNION triggers a dedupe pass — use UNION ALL if duplicates can't occur.",
      });
    }
    return out;
  },
};
