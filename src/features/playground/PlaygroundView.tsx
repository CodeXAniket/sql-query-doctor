import { useState } from "react";
import { useDatabase } from "./useDatabase";
import { BenchmarkPanel } from "./BenchmarkPanel";
import { SqlEditor } from "../analyzer/SqlEditor";
import { PlanTree } from "../plan/PlanTree";
import { parsePlan } from "../../lib/plan/parse";
import type { ParsedPlan, PlanNode } from "../../lib/plan/types";
import { summarizePlan } from "../../lib/plan/metrics";
import type { QueryResult } from "../../lib/db/types";
import { Button, Card, Badge } from "../../components/ui/primitives";
import { Bolt } from "../../components/Decor";

const STARTER_SQL = `SELECT status, count(*) AS orders, round(avg(total), 2) AS avg_total
FROM orders
WHERE created_at > now() - interval '30 days'
GROUP BY status
ORDER BY orders DESC;`;

export function PlaygroundView() {
  const db = useDatabase();
  const [orders, setOrders] = useState(500_000);
  const [sql, setSql] = useState(STARTER_SQL);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [selected, setSelected] = useState<PlanNode | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setQueryError(null);
    setPlan(null);
    try {
      setResult(await db.runQuery(sql));
    } catch (e) {
      setQueryError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const explain = async () => {
    setBusy(true);
    setQueryError(null);
    try {
      const json = await db.explain(sql, true);
      setPlan(parsePlan(json, "postgresql"));
      setSelected(null);
    } catch (e) {
      setQueryError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="view-head">
        <div>
          <h1 className="view-title">Playground</h1>
          <p className="view-sub">
            A real PostgreSQL running in your browser via PGlite (WebAssembly). Seed a ~500K-row
            dataset, run queries, view live EXPLAIN ANALYZE plans, and benchmark the impact of
            indexes.
          </p>
        </div>
      </div>

      {db.status !== "ready" ? (
        <Card>
          <div className="card-body">
            <div className="boot">
              <span className="logo__mark" style={{ width: 64, height: 64 }}>
                <Bolt size={40} />
              </span>
              <h2 className="empty__title">In-browser Postgres</h2>
              <p style={{ maxWidth: "52ch" }}>
                Nothing is sent to a server — PGlite compiles PostgreSQL to WebAssembly and runs it
                right here. Pick a dataset size and initialize.
              </p>

              {db.status === "idle" && (
                <>
                  <div className="seg" role="group" aria-label="Dataset size">
                    {[100_000, 500_000].map((n) => (
                      <button
                        key={n}
                        className="seg__opt"
                        aria-pressed={orders === n}
                        onClick={() => setOrders(n)}
                      >
                        {(n / 1000).toLocaleString()}k orders
                      </button>
                    ))}
                  </div>
                  <Button size="lg" onClick={() => db.init(orders)}>
                    Initialize Postgres
                  </Button>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                    Seeding {(orders / 1000).toLocaleString()}k rows takes a few seconds.
                  </p>
                </>
              )}

              {(db.status === "booting" || db.status === "seeding") && (
                <div className="progress" style={{ width: "100%", maxWidth: 420 }}>
                  <div className="progress__bar">
                    <div
                      className="progress__fill"
                      style={{
                        width: db.progress ? `${(db.progress.done / db.progress.total) * 100}%` : "8%",
                      }}
                    />
                  </div>
                  <div className="progress__label">
                    {db.status === "booting"
                      ? "Booting PostgreSQL (WASM)…"
                      : db.progress
                        ? `${db.progress.phase} · ${db.progress.done.toLocaleString()}/${db.progress.total.toLocaleString()}`
                        : "Seeding…"}
                  </div>
                </div>
              )}

              {db.status === "error" && (
                <>
                  <Badge tone="critical">Error</Badge>
                  <p>{db.error}</p>
                  <Button onClick={() => db.init(orders)}>Retry</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="metrics-row">
            {Object.entries(db.rowCounts).map(([t, c]) => (
              <div className="metric" key={t}>
                <div className="metric__value">{c.toLocaleString()}</div>
                <div className="metric__label">{t}</div>
              </div>
            ))}
            <div className="metric" style={{ background: "var(--lime-300)" }}>
              <div className="metric__value">READY</div>
              <div className="metric__label">PGlite · WASM</div>
            </div>
          </div>

          <Card>
            <div className="card-head">
              <span className="panel-title">Query runner</span>
              <div className="toolbar">
                <Button onClick={run} disabled={busy}>
                  {busy ? "Running…" : "Run"}
                </Button>
                <Button variant="secondary" onClick={explain} disabled={busy}>
                  Explain analyze
                </Button>
              </div>
            </div>
            <div className="card-body card-body--flush">
              <SqlEditor value={sql} onChange={setSql} dialect="postgresql" height="180px" />
            </div>

            {queryError && (
              <div className="plan-warnings">
                <div className="plan-warning">✗ {queryError}</div>
              </div>
            )}

            {result && (
              <div className="card-body">
                <div className="toolbar" style={{ marginBottom: 12 }}>
                  <Badge tone="ok">{result.rowCount.toLocaleString()} rows</Badge>
                  <Badge tone="neutral">{result.durationMs.toFixed(1)} ms</Badge>
                </div>
                <ResultsGrid result={result} />
              </div>
            )}
          </Card>

          {plan && (
            <Card>
              <div className="card-head">
                <span className="panel-title">Live plan · EXPLAIN ANALYZE</span>
                <Badge tone={summarizePlan(plan).badEstimateCount > 0 ? "high" : "ok"}>
                  {summarizePlan(plan).badEstimateCount} bad estimates
                </Badge>
              </div>
              <div className="card-body card-body--flush">
                <PlanTree plan={plan} selectedId={selected?.id} onSelect={setSelected} />
              </div>
            </Card>
          )}

          <BenchmarkPanel getDb={db.getDb} />
        </>
      )}
    </div>
  );
}

function ResultsGrid({ result }: { result: QueryResult }) {
  if (result.rows.length === 0) {
    return <div className="empty">Query returned no rows.</div>;
  }
  const columns = Object.keys(result.rows[0]);
  const rows = result.rows.slice(0, 100);
  return (
    <div className="grid-scroll">
      <table className="grid">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>{formatCell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > 100 && (
        <div className="grid-more">Showing first 100 of {result.rows.length.toLocaleString()} rows</div>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "∅";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
