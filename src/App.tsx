import { lazy, Suspense, useState } from "react";
import { Bolt, Star, Blob } from "./components/Decor";
import { AnalyzerView } from "./features/analyzer/AnalyzerView";

const PlanView = lazy(() =>
  import("./features/plan/PlanView").then((m) => ({ default: m.PlanView })),
);
const PlaygroundView = lazy(() =>
  import("./features/playground/PlaygroundView").then((m) => ({ default: m.PlaygroundView })),
);

type Tab = "analyzer" | "plan" | "playground";

const TABS: { id: Tab; label: string; index: string }[] = [
  { id: "analyzer", label: "Analyzer", index: "01" },
  { id: "plan", label: "Plan Tree", index: "02" },
  { id: "playground", label: "Playground", index: "03" },
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
          {tab === "plan" && <PlanView />}
          {tab === "playground" && <PlaygroundView />}
        </Suspense>
      </main>

      <footer className="footer">
        <div className="footer__badge">Since 2026 · Built for slow queries</div>
        <div>
          SQL Query Doctor — 19 anti-pattern rules · 4 dialects · unified plan tree · in-browser
          Postgres (PGlite / WASM)
        </div>
      </footer>
    </div>
  );
}
