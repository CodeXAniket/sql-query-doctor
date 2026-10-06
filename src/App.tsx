import { lazy, Suspense, useState } from "react";
import { Bolt, Star, Blob } from "./components/Decor";
import { AnalyzerView } from "./features/analyzer/AnalyzerView";

const BenchmarkView = lazy(() =>
  import("./features/benchmark/BenchmarkView").then((m) => ({ default: m.BenchmarkView })),
);

type Tab = "analyzer" | "benchmark";

const TABS: { id: Tab; label: string; index: string }[] = [
  { id: "analyzer", label: "Analyzer", index: "01" },
  { id: "benchmark", label: "Benchmark", index: "02" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("analyzer");

  return (
    <div className="app">
      <header className="header">
        <div className="header__bar">
          <a className="logo" href="#" onClick={(e) => e.preventDefault()}>
            <span className="logo__mark">
              <Bolt size={30} />
            </span>
            <span className="logo__text">
              <span className="logo__title">SQL Doctor</span>
              <span className="logo__sub">Query Performance Clinic</span>
            </span>
          </a>
          <nav className="header__nav" role="tablist" aria-label="Tools">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                className="pill"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                <span className="pill__num">{t.index}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {/* Decorative Memphis shapes */}
        <Bolt size={54} className="decor" style={{ top: -6, right: 40, transform: "rotate(12deg)" }} />
        <Star size={40} className="decor" style={{ top: 120, right: -6 }} />
        <Blob size={64} className="decor" style={{ bottom: 40, left: -18 }} />

        <Suspense fallback={<div className="empty"><div className="empty__title">Loading…</div></div>}>
          {tab === "analyzer" && <AnalyzerView />}
          {tab === "benchmark" && <BenchmarkView />}
        </Suspense>
      </main>

      <footer className="footer">
        <div className="footer__badge">Since 2026 · Built for slow queries</div>
        <div>
          SQL Query Doctor — 19 anti-pattern rules · 4 dialects · live index benchmark on in-browser
          Postgres (PGlite / WASM)
        </div>
      </footer>
    </div>
  );
}
