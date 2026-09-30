import type { QueryExecutor } from "../db/types";
import { createSuggestedIndexes, dropSuggestedIndexes } from "../db/indexes";
import { BENCHMARK_QUERIES, type BenchmarkQuery } from "./queries";

/* -------------------------------------------------------------------------
   Pure statistics helpers
   ------------------------------------------------------------------------- */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/** Time a single query `repeats` times and return the best (min) duration. */
export async function timeQuery(
  db: QueryExecutor,
  sql: string,
  repeats: number,
): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < repeats; i++) {
    const { durationMs } = await db.run(sql);
    best = Math.min(best, durationMs);
  }
  return best === Infinity ? 0 : best;
}

/* -------------------------------------------------------------------------
   Benchmark orchestration
   ------------------------------------------------------------------------- */

export interface QueryResult {
  id: string;
  label: string;
  pattern: BenchmarkQuery["pattern"];
  beforeMs: number;
  afterMs: number;
  /** afterMs / beforeMs speed-up factor (>=1 means faster). */
  speedup: number;
}

export interface BenchmarkReport {
  results: QueryResult[];
  medianBeforeMs: number;
  medianAfterMs: number;
  /** Overall median speed-up factor across all queries. */
  medianSpeedup: number;
  totalBeforeMs: number;
  totalAfterMs: number;
  queryCount: number;
}

export function speedup(beforeMs: number, afterMs: number): number {
  if (afterMs <= 0) return beforeMs > 0 ? Infinity : 1;
  return beforeMs / afterMs;
}

/** Aggregate per-query results into a report (pure — unit tested). */
export function buildReport(results: QueryResult[]): BenchmarkReport {
  const before = results.map((r) => r.beforeMs);
  const after = results.map((r) => r.afterMs);
  return {
    results,
    medianBeforeMs: median(before),
    medianAfterMs: median(after),
    medianSpeedup: median(results.map((r) => r.speedup)),
    totalBeforeMs: before.reduce((a, b) => a + b, 0),
    totalAfterMs: after.reduce((a, b) => a + b, 0),
    queryCount: results.length,
  };
}

export interface BenchmarkOptions {
  repeats?: number;
  queries?: BenchmarkQuery[];
  onProgress?: (info: { phase: string; done: number; total: number }) => void;
}

/**
 * Run the full benchmark: measure each query with indexes dropped, create the
 * suggested indexes, measure again, and report the deltas.
 */
export async function runBenchmark(
  db: QueryExecutor,
  options: BenchmarkOptions = {},
): Promise<BenchmarkReport> {
  const { repeats = 3, queries = BENCHMARK_QUERIES, onProgress } = options;
  const total = queries.length * 2;
  let done = 0;

  await dropSuggestedIndexes(db);
  const before = new Map<string, number>();
  for (const q of queries) {
    before.set(q.id, await timeQuery(db, q.sql, repeats));
    onProgress?.({ phase: "Measuring without indexes", done: ++done, total });
  }

  await createSuggestedIndexes(db);
  const after = new Map<string, number>();
  for (const q of queries) {
    after.set(q.id, await timeQuery(db, q.sql, repeats));
    onProgress?.({ phase: "Measuring with indexes", done: ++done, total });
  }

  const results: QueryResult[] = queries.map((q) => {
    const beforeMs = before.get(q.id) ?? 0;
    const afterMs = after.get(q.id) ?? 0;
    return {
      id: q.id,
      label: q.label,
      pattern: q.pattern,
      beforeMs,
      afterMs,
      speedup: speedup(beforeMs, afterMs),
    };
  });

  return buildReport(results);
}
