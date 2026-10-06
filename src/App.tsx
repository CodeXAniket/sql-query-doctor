import { Bolt, Star, Blob } from "./components/Decor";
import { AnalyzerView } from "./features/analyzer/AnalyzerView";

export function App() {
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
        </div>
      </header>

      <main className="main">
        {/* Decorative Memphis shapes */}
        <Bolt size={54} className="decor" style={{ top: -6, right: 40, transform: "rotate(12deg)" }} />
        <Star size={40} className="decor" style={{ top: 120, right: -6 }} />
        <Blob size={64} className="decor" style={{ bottom: 40, left: -18 }} />

        <AnalyzerView />
      </main>

      <footer className="footer">
        <div className="footer__badge">Since 2026 · Built for slow queries</div>
        <div>SQL Query Doctor — 19 anti-pattern rules · 4 dialects · instant, explained fixes</div>
      </footer>
    </div>
  );
}
