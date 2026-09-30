import type { Detection, Rule } from "../types";
import { scan } from "../scan";

/* -------------------------------------------------------------------------
   R14 — ORDER BY random()
   ------------------------------------------------------------------------- */
export const orderByRandom: Rule = {
  id: "order-by-random",
  title: "ORDER BY random()",
  category: "sorting",
  severity: "high",
  summary: "Sorting by a random value reads and sorts the whole table to pick a few rows.",
  explanation:
    "ORDER BY RANDOM() / RAND() / NEWID() assigns a random key to every row and sorts the " +
    "entire table, even when you only want a handful of rows via LIMIT. Cost scales with the " +
    "full table size on every execution.",
  suggestion:
    "For a random sample use TABLESAMPLE (PostgreSQL/SQL Server), or pick random ids in the " +
    "application and fetch by primary key, or use a keyset on a precomputed random column.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\border\s+by\s+(?:rand|random|newid)\s*\(\s*\)/gi)) {
      out.push({
        index: match.index,
        length: match[0].length,
        message: "ORDER BY random() sorts the entire table — use sampling or key-based selection.",
      });
    }
    return out;
  },
};

/* -------------------------------------------------------------------------
   R15 — LIMIT without ORDER BY
   ------------------------------------------------------------------------- */
export const limitWithoutOrderBy: Rule = {
  id: "limit-without-order-by",
  title: "LIMIT without ORDER BY",
  category: "correctness",
  severity: "low",
  summary: "LIMIT with no ORDER BY returns an arbitrary, non-deterministic subset of rows.",
  explanation:
    "Without ORDER BY the database is free to return any rows for a LIMIT, and the set can " +
    "change between runs as the plan or physical row order changes. This is a correctness " +
    "hazard for pagination and 'top N' queries.",
  suggestion:
    "Add an explicit, deterministic ORDER BY (ideally on a unique/indexed column) so the " +
    "LIMIT is stable and index-friendly.",
  detect(ctx) {
    const out: Detection[] = [];
    for (const { match } of scan(ctx, /\blimit\b/gi)) {
      // Look backward within the same statement for an ORDER BY.
      const stmtStart = ctx.lower.lastIndexOf(";", match.index) + 1;
      const before = ctx.lower.slice(stmtStart, match.index);
      if (!/\border\s+by\b/.test(before)) {
        out.push({
          index: match.index,
          length: match[0].length,
          message: "LIMIT without ORDER BY returns a non-deterministic subset.",
        });
      }
    }
    return out;
  },
};
