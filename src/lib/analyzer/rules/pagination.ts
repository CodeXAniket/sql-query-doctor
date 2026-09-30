import type { Detection, Rule } from "../types";
import { scan } from "../scan";

/* -------------------------------------------------------------------------
   R16 — Large OFFSET pagination
   ------------------------------------------------------------------------- */
export const largeOffset: Rule = {
  id: "large-offset-pagination",
  title: "Large OFFSET pagination",
  category: "pagination",
  severity: "medium",
  summary: "OFFSET N still reads and discards the first N rows — deep pages get progressively slow.",
  explanation:
    "OFFSET does not skip work: the database produces every row up to the offset and throws " +
    "them away before returning the page. Page 1,000 costs far more than page 1, so deep " +
    "pagination degrades linearly with page depth.",
  suggestion:
    "Use keyset (a.k.a. seek) pagination: remember the last row's sort key and query " +
    "WHERE key > :lastKey ORDER BY key LIMIT n. It stays O(page size) at any depth.",
  detect(ctx) {
    const out: Detection[] = [];
    const THRESHOLD = 1000;
    for (const { match } of scan(ctx, /\boffset\s+(\d+)/gi)) {
      const n = Number(match[1]);
      if (n >= THRESHOLD) {
        out.push({
          index: match.index,
          length: match[0].length,
          message: `OFFSET ${n} discards ${n} rows on every call — switch to keyset pagination.`,
        });
      }
    }
    return out;
  },
};
