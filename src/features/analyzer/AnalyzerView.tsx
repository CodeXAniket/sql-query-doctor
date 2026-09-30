import { useMemo, useState } from "react";
import { analyzeSql } from "../../lib/analyzer/analyze";
import { DIALECTS, SEVERITY_ORDER, type Dialect, type Severity } from "../../lib/analyzer/types";
import { ALL_RULES } from "../../lib/analyzer/rules";
import { Button, Card, Select, Badge } from "../../components/ui/primitives";
import { SqlEditor } from "./SqlEditor";
import { FindingCard } from "./FindingCard";
import { ANALYZER_EXAMPLES } from "./examples";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export function AnalyzerView() {
  const [dialect, setDialect] = useState<Dialect>("postgresql");
  const [sql, setSql] = useState(ANALYZER_EXAMPLES[0].sql);
  const [filter, setFilter] = useState<Severity | "all">("all");

  const result = useMemo(() => analyzeSql(sql, dialect), [sql, dialect]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? result.findings
        : result.findings.filter((f) => f.severity === filter),
    [result, filter],
  );

  const totalRules = ALL_RULES.length;

  return (
    <div className="stack">
      <div className="view-head">
        <div>
          <h1 className="view-title">Analyzer</h1>
          <p className="view-sub">
            Paste a query, pick a dialect, and get instant feedback on {totalRules} performance
            anti-patterns — each with the reason it's slow and how to fix it.
          </p>
        </div>
      </div>

      <div className="split">
        {/* ---- Editor column ---- */}
        <Card>
          <div className="card-head">
            <span className="panel-title">Query</span>
            <div className="toolbar">
              <Select
                aria-label="Dialect"
                value={dialect}
                onChange={(e) => setDialect(e.target.value as Dialect)}
                options={DIALECTS.map((d) => ({ value: d.id, label: d.label }))}
              />
              <Select
                aria-label="Load example"
                value=""
                onChange={(e) => {
                  const ex = ANALYZER_EXAMPLES[Number(e.target.value)];
                  if (ex) {
                    setSql(ex.sql);
                    setDialect(ex.dialect);
                  }
                }}
                options={[
                  { value: "", label: "Load example…" },
                  ...ANALYZER_EXAMPLES.map((ex, i) => ({ value: String(i), label: ex.label })),
                ]}
              />
            </div>
          </div>
          <div className="card-body card-body--flush">
            <SqlEditor value={sql} onChange={setSql} dialect={dialect} height="420px" />
          </div>
          <div className="card-head" style={{ borderTop: "3px solid var(--black)", borderBottom: "none" }}>
            {result.parseError ? (
              <Badge tone="medium">Parse warning — linting on raw text</Badge>
            ) : sql.trim() ? (
              <Badge tone="ok">Parses cleanly as {DIALECTS.find((d) => d.id === dialect)?.label}</Badge>
            ) : (
              <span className="chip">Empty query</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSql("")}>
              Clear
            </Button>
          </div>
        </Card>

        {/* ---- Findings column ---- */}
        <Card>
          <div className="card-head">
            <span className="panel-title">
              Findings{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                ({result.findings.length})
              </span>
            </span>
            <div className="toolbar">
              <button
                className="seg__opt"
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
                style={filterStyle}
              >
                All
              </button>
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  className="seg__opt"
                  aria-pressed={filter === s}
                  onClick={() => setFilter(s)}
                  style={filterStyle}
                >
                  <Badge tone={s}>{result.counts[s]}</Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="card-body">
            {result.findings.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: "2.4rem" }}>✓</div>
                <div className="empty__title">All clear</div>
                <p>No anti-patterns detected. This query looks index-friendly.</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="empty">
                <p>No {filter} findings.</p>
              </div>
            ) : (
              <div className="findings-list">
                {[...visible]
                  .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.line - b.line)
                  .map((f, i) => (
                    <FindingCard key={`${f.ruleId}-${f.index}-${i}`} finding={f} />
                  ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <RulesCatalog />
    </div>
  );
}

const filterStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6 };

function RulesCatalog() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="card-head">
        <span className="panel-title">Rule catalog · {ALL_RULES.length} rules</span>
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show all rules"}
        </Button>
      </div>
      {open && (
        <div className="card-body">
          <div className="rules-grid">
            {ALL_RULES.map((r) => (
              <div key={r.id} className="rule-item">
                <div className="rule-item__head">
                  <Badge tone={r.severity} dot>
                    {r.severity}
                  </Badge>
                  <span className="rule-item__title">{r.title}</span>
                </div>
                <p className="rule-item__summary">{r.summary}</p>
                <code className="rule-item__id">{r.id}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
