import { useCallback, useRef, useState } from "react";
import { PgliteExecutor } from "../../lib/db/client";
import { seedDatabase, DATASET } from "../../lib/db/schema";
import type { QueryResult } from "../../lib/db/types";

export type DbStatus = "idle" | "booting" | "seeding" | "ready" | "error";

export interface Progress {
  phase: string;
  done: number;
  total: number;
}

export function useDatabase() {
  const dbRef = useRef<PgliteExecutor | null>(null);
  const [status, setStatus] = useState<DbStatus>("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});

  const init = useCallback(async (orders: number) => {
    setError(null);
    try {
      setStatus("booting");
      if (!dbRef.current) dbRef.current = await PgliteExecutor.create();
      const db = dbRef.current;

      setStatus("seeding");
      const sizes = { ...DATASET, orders };
      await seedDatabase(db, (p) => setProgress(p), sizes);

      const counts: Record<string, number> = {};
      for (const t of ["users", "products", "orders"]) counts[t] = await db.rowCount(t);
      setRowCounts(counts);
      setStatus("ready");
      setProgress(null);
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  const runQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    if (!dbRef.current) throw new Error("Database not ready");
    return dbRef.current.run(sql);
  }, []);

  const explain = useCallback(async (sql: string, analyze: boolean): Promise<string> => {
    if (!dbRef.current) throw new Error("Database not ready");
    return dbRef.current.explainJson(sql, analyze);
  }, []);

  const getDb = useCallback(() => dbRef.current, []);

  return { status, progress, error, rowCounts, init, runQuery, explain, getDb };
}
