import { useState } from "react";
import { useDatabase } from "./useDatabase";
import { BenchmarkPanel } from "./BenchmarkPanel";
import { Button, Card, Badge } from "../../components/ui/primitives";
import { Bolt } from "../../components/Decor";

export function BenchmarkView() {
  const db = useDatabase();
  const [orders, setOrders] = useState(500_000);

  return (
    <div className="stack">
      <div className="view-head">
        <div>
          <h1 className="view-title">Benchmark</h1>
          <p className="view-sub">
            A real PostgreSQL runs in your browser via PGlite (WebAssembly). Seed a ~500K-row
            dataset, then measure how much the suggested indexes actually speed up 30 queries — the
            numbers are measured live, not hard-coded.
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

          <BenchmarkPanel getDb={db.getDb} />
        </>
      )}
    </div>
  );
}
