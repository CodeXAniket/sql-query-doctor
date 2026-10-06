import { useState } from "react";
import { runBenchmark, type BenchmarkReport } from "../../lib/benchmark/runner";
import { SUGGESTED_INDEXES } from "../../lib/db/indexes";
import type { PgliteExecutor } from "../../lib/db/client";
import { Button, Card, Badge } from "../../components/ui/primitives";

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}

export function BenchmarkPanel({ getDb }: { getDb: () => PgliteExecutor | null }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; done: number; total: number } | null>(null);
  const [report, setReport] = useState<BenchmarkReport | null>(null);

  const run = async () => {
    const db = getDb();
    if (!db) return;
    setRunning(true);
    setReport(null);
    try {
      const r = await runBenchmark(db, {
        repeats: 3,
        onProgress: (p) => setProgress(p),
      });
      setReport(r);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const maxBefore = report ? Math.max(...report.results.map((r) => r.beforeMs), 1) : 1;

  return (
    <Card>
      <div className="card-head">
        <span className="panel-title">Index benchmark · 30 queries</span>
        <Button onClick={run} disabled={running}>
          {running ? "Running…" : "Run benchmark"}
        </Button>
      </div>

      <div className="card-body">
        <p className="view-sub" style={{ marginTop: 0 }}>
          Runs all 30 queries with no secondary indexes, then adds {SUGGESTED_INDEXES.length}{" "}
          suggested indexes and re-runs them — reporting the measured, live median speed-up.
        </p>

        {running && progress && (
          <div className="progress">
            <div className="progress__bar">
              <div className="progress__fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <div className="progress__label">
              {progress.phase} · {progress.done}/{progress.total}
            </div>
          </div>
        )}

        {report && (
          <>
            <div className="metrics-row" style={{ marginBottom: 18 }}>
              <div className="metric">
                <div className="metric__value">{fmtMs(report.medianBeforeMs)}</div>
                <div className="metric__label">Median · no indexes</div>
              </div>
              <div className="metric" style={{ background: "var(--lime-300)" }}>
                <div className="metric__value">{fmtMs(report.medianAfterMs)}</div>
                <div className="metric__label">Median · indexed</div>
              </div>
              <div className="metric" style={{ background: "var(--pink-200)" }}>
                <div className="metric__value">
                  {report.medianSpeedup === Infinity ? "∞" : `${report.medianSpeedup.toFixed(1)}×`}
                </div>
                <div className="metric__label">Median speed-up</div>
              </div>
            </div>

            <div className="bench-list">
              {report.results.map((r) => (
                <div key={r.id} className="bench-row">
                  <span className="bench-row__label" title={r.label}>
                    {r.label}
                  </span>
                  <span className="bench-row__bars">
                    <span className="bench-bar bench-bar--before" style={{ width: `${(r.beforeMs / maxBefore) * 100}%` }} />
                    <span className="bench-bar bench-bar--after" style={{ width: `${(r.afterMs / maxBefore) * 100}%` }} />
                  </span>
                  <span className="bench-row__nums">
                    <span className="bench-row__before">{fmtMs(r.beforeMs)}</span>
                    <span className="bench-row__arrow">→</span>
                    <span className="bench-row__after">{fmtMs(r.afterMs)}</span>
                    <Badge tone={r.speedup >= 2 ? "ok" : "neutral"}>
                      {r.speedup === Infinity ? "∞" : `${r.speedup.toFixed(1)}×`}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {!report && !running && (
          <div className="index-list">
            {SUGGESTED_INDEXES.map((idx) => (
              <div key={idx.name} className="index-item">
                <code>{idx.name}</code>
                <span>{idx.rationale}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
