import { PGlite } from "@electric-sql/pglite";
import type { QueryExecutor, QueryResult } from "./types";

/**
 * PGlite-backed executor: a full PostgreSQL running in WebAssembly, in the
 * browser tab. Implements the QueryExecutor interface used by the benchmark.
 */
export class PgliteExecutor implements QueryExecutor {
  private constructor(private readonly db: PGlite) {}

  static async create(): Promise<PgliteExecutor> {
    const db = await PGlite.create();
    return new PgliteExecutor(db);
  }

  async run(sql: string): Promise<QueryResult> {
    const start = performance.now();
    const res = await this.db.query(sql);
    const durationMs = performance.now() - start;
    const rows = (res.rows as Record<string, unknown>[]) ?? [];
    // SELECTs report affectedRows = 0 in PGlite, so fall back to the row count.
    const rowCount = rows.length > 0 ? rows.length : (res.affectedRows ?? 0);
    return { rows, durationMs, rowCount };
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  /** Convenience: does a table exist? Used to decide whether to seed. */
  async isSeeded(): Promise<boolean> {
    try {
      const res = await this.db.query(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' LIMIT 1;",
      );
      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  async rowCount(table: string): Promise<number> {
    const res = await this.db.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${table};`);
    return res.rows[0]?.c ?? 0;
  }
}
