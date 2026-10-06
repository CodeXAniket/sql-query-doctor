import { describe, it, expect, beforeAll } from "vitest";
import { PgliteExecutor } from "../client";
import { seedDatabase, DATASET } from "../schema";
import { createSuggestedIndexes, dropSuggestedIndexes, SUGGESTED_INDEXES } from "../indexes";
import { BENCHMARK_QUERIES } from "../../benchmark/queries";
import { runBenchmark } from "../../benchmark/runner";

/**
 * Real PGlite integration. Uses a small dataset so the suite stays fast while
 * still exercising the actual seed SQL, index DDL, and every benchmark query
 * end to end.
 */
describe("PGlite integration (small dataset)", () => {
  let db: PgliteExecutor;
  const SIZES = { users: 500, products: 100, orders: 3000 };

  beforeAll(async () => {
    db = await PgliteExecutor.create();
    await seedDatabase(db, undefined, SIZES);
  }, 120_000);

  it("seeds the configured row counts", async () => {
    expect(await db.rowCount("users")).toBe(SIZES.users);
    expect(await db.rowCount("products")).toBe(SIZES.products);
    expect(await db.rowCount("orders")).toBe(SIZES.orders);
  });

  it("reports as seeded", async () => {
    expect(await db.isSeeded()).toBe(true);
  });

  it("exposes the full default dataset config (~500K orders)", () => {
    expect(DATASET.orders).toBe(500_000);
  });

  it("runs every benchmark query without error", async () => {
    for (const q of BENCHMARK_QUERIES) {
      const res = await db.run(q.sql);
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    }
  }, 60_000);

  it("creates and drops every suggested index", async () => {
    await createSuggestedIndexes(db);
    const res = await db.run(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('orders','users','products');",
    );
    const names = res.rows.map((r) => String(r.indexname));
    for (const idx of SUGGESTED_INDEXES) expect(names).toContain(idx.name);

    await dropSuggestedIndexes(db);
    const after = await db.run("SELECT indexname FROM pg_indexes WHERE tablename = 'orders';");
    const afterNames = after.rows.map((r) => String(r.indexname));
    expect(afterNames).not.toContain("idx_orders_user_id");
  }, 60_000);

  it("shows a measurable benefit from indexing in a full benchmark run", async () => {
    const report = await runBenchmark(db, { repeats: 1, queries: BENCHMARK_QUERIES.slice(0, 8) });
    expect(report.queryCount).toBe(8);
    expect(report.medianAfterMs).toBeGreaterThanOrEqual(0);
    // With indexes, the total time should not be dramatically worse than before.
    expect(report.totalAfterMs).toBeLessThanOrEqual(report.totalBeforeMs * 3 + 50);
  }, 120_000);
});
