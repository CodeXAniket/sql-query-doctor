import { describe, it, expect } from "vitest";
import {
  median,
  percentile,
  speedup,
  buildReport,
  runBenchmark,
  timeQuery,
  type QueryResult,
} from "../runner";
import { BENCHMARK_QUERIES } from "../queries";
import { parseSql } from "../../parser/parse";
import type { QueryExecutor, QueryResult as ExecResult } from "../../db/types";

describe("median", () => {
  it("returns 0 for an empty array", () => {
    expect(median([])).toBe(0);
  });
  it("handles an odd count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the middle two for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("is order-independent", () => {
    expect(median([10, 1, 5, 2, 8])).toBe(median([1, 2, 5, 8, 10]));
  });
});

describe("percentile", () => {
  it("returns the min at p0 and max at p100", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 100)).toBe(5);
  });
  it("interpolates between ranks", () => {
    expect(percentile([0, 10], 50)).toBe(5);
  });
  it("returns 0 for empty input", () => {
    expect(percentile([], 95)).toBe(0);
  });
});

describe("speedup", () => {
  it("computes before/after ratio", () => {
    expect(speedup(1200, 25)).toBeCloseTo(48, 0);
  });
  it("returns 1 when both are zero", () => {
    expect(speedup(0, 0)).toBe(1);
  });
  it("is Infinity when after is zero but before is positive", () => {
    expect(speedup(100, 0)).toBe(Infinity);
  });
});

describe("buildReport", () => {
  const results: QueryResult[] = [
    { id: "a", label: "A", pattern: "filter", beforeMs: 100, afterMs: 10, speedup: 10 },
    { id: "b", label: "B", pattern: "join", beforeMs: 200, afterMs: 20, speedup: 10 },
    { id: "c", label: "C", pattern: "range", beforeMs: 300, afterMs: 60, speedup: 5 },
  ];
  const report = buildReport(results);

  it("computes median before and after", () => {
    expect(report.medianBeforeMs).toBe(200);
    expect(report.medianAfterMs).toBe(20);
  });
  it("computes median speedup", () => {
    expect(report.medianSpeedup).toBe(10);
  });
  it("sums totals", () => {
    expect(report.totalBeforeMs).toBe(600);
    expect(report.totalAfterMs).toBe(90);
  });
  it("records the query count", () => {
    expect(report.queryCount).toBe(3);
  });
});

describe("benchmark query catalog", () => {
  it("has exactly 30 queries", () => {
    expect(BENCHMARK_QUERIES).toHaveLength(30);
  });
  it("has unique ids", () => {
    expect(new Set(BENCHMARK_QUERIES.map((q) => q.id)).size).toBe(30);
  });
  it("every query parses as valid PostgreSQL", () => {
    for (const q of BENCHMARK_QUERIES) {
      expect(parseSql(q.sql, "postgresql").error, `${q.id}: ${q.sql}`).toBeUndefined();
    }
  });
  it("every query has a non-empty label and known pattern", () => {
    const patterns = new Set(["point-lookup", "filter", "range", "join", "aggregate", "sort"]);
    for (const q of BENCHMARK_QUERIES) {
      expect(q.label.length).toBeGreaterThan(0);
      expect(patterns.has(q.pattern)).toBe(true);
    }
  });
});

/* A deterministic mock executor: queries against tables named with "idx_" in a
   tracked set run "fast"; before indexes exist they run "slow". */
class MockExecutor implements QueryExecutor {
  private indexed = false;
  calls: string[] = [];
  async run(sql: string): Promise<ExecResult> {
    this.calls.push(sql);
    const durationMs = this.indexed ? 5 : 100;
    return { rows: [], durationMs, rowCount: 0 };
  }
  async exec(sql: string): Promise<void> {
    this.calls.push(sql);
    if (/CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql)) this.indexed = true;
    if (/DROP\s+INDEX/i.test(sql)) this.indexed = false;
  }
}

describe("timeQuery", () => {
  it("returns the best of several runs", async () => {
    let n = 0;
    const db: QueryExecutor = {
      run: async () => ({ rows: [], durationMs: [50, 10, 30][n++] ?? 0, rowCount: 0 }),
      exec: async () => {},
    };
    expect(await timeQuery(db, "SELECT 1", 3)).toBe(10);
  });
});

describe("runBenchmark orchestration", () => {
  it("measures before (no index) and after (indexed) and reports a speed-up", async () => {
    const db = new MockExecutor();
    const queries = BENCHMARK_QUERIES.slice(0, 5);
    const progress: number[] = [];
    const report = await runBenchmark(db, {
      repeats: 1,
      queries,
      onProgress: (p) => progress.push(p.done),
    });
    expect(report.queryCount).toBe(5);
    expect(report.medianBeforeMs).toBe(100);
    expect(report.medianAfterMs).toBe(5);
    expect(report.medianSpeedup).toBe(20);
    // Progress fires twice per query (before + after).
    expect(progress).toHaveLength(10);
    // Indexes were dropped first, then created.
    expect(db.calls.some((c) => /DROP INDEX/i.test(c))).toBe(true);
    expect(db.calls.some((c) => /CREATE INDEX/i.test(c))).toBe(true);
  });
});
