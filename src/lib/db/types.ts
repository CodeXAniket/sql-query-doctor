/* =========================================================================
   Database abstraction — a minimal executor interface so the benchmark and
   playground logic can run against real PGlite or a mock in tests.
   ========================================================================= */

export interface QueryResult {
  rows: Record<string, unknown>[];
  /** Wall-clock duration of the call in milliseconds. */
  durationMs: number;
  /** Number of rows returned (or affected). */
  rowCount: number;
}

export interface QueryExecutor {
  /** Run a statement and return rows + timing. */
  run(sql: string): Promise<QueryResult>;
  /** Run a statement without collecting timing (DDL, seeding). */
  exec(sql: string): Promise<void>;
}

export type SeedProgress = (info: { phase: string; done: number; total: number }) => void;
