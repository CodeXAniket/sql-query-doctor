import { useMemo, useState } from "react";
import { parsePlan, detectEngine } from "../../lib/plan/parse";
import { PLAN_SAMPLES } from "../../lib/plan/samples";
import { PLAN_ENGINES, PlanParseError, type PlanEngine, type PlanNode, type ParsedPlan } from "../../lib/plan/types";
import { summarizePlan, rowEstimateError } from "../../lib/plan/metrics";
import { Button, Card, Select, Badge } from "../../components/ui/primitives";
import { PlanTree } from "./PlanTree";

export function PlanView({ injected }: { injected?: { text: string; engine: PlanEngine } }) {
  const [engine, setEngine] = useState<PlanEngine>(injected?.engine ?? "postgresql");
  const [text, setText] = useState(injected?.text ?? PLAN_SAMPLES.postgresql);
  const [selected, setSelected] = useState<PlanNode | null>(null);

  const parsed = useMemo(() => {
    try {
      const plan = parsePlan(text, engine);
      return { plan, error: null as string | null };
    } catch (e) {
      return {
        plan: null,
        error: e instanceof PlanParseError ? e.message : (e as Error).message,
      };
    }
  }, [text, engine]);

  const summary = parsed.plan ? summarizePlan(parsed.plan) : null;

  return (
    <div className="stack">
      <div className="view-head">
        <div>
          <h1 className="view-title">Plan Tree</h1>
          <p className="view-sub">
            Paste EXPLAIN output from any of four engines. It's normalized into one model and drawn
            as a D3 tree — heat-coloured by cost, with row-estimate errors above 10× flagged.
          </p>
        </div>
      </div>

      <Card>
        <div className="card-head">
          <div className="toolbar">
            <div>
              <span className="field-label">Engine</span>
              <Select
                value={engine}
                onChange={(e) => setEngine(e.target.value as PlanEngine)}
                options={PLAN_ENGINES.map((p) => ({ value: p.id, label: p.label }))}
              />
            </div>
            <div>
              <span className="field-label">Expected format</span>
              <code className="chip chip--code" style={{ padding: "9px 14px" }}>
                {PLAN_ENGINES.find((p) => p.id === engine)?.format}
              </code>
            </div>
          </div>
          <div className="toolbar toolbar__spacer">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setText(PLAN_SAMPLES[engine]);
                setSelected(null);
              }}
            >
              Load {PLAN_ENGINES.find((p) => p.id === engine)?.label} example
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const detected = detectEngine(text);
                setEngine(detected);
              }}
            >
              Auto-detect
            </Button>
          </div>
        </div>
        <div className="card-body">
          <textarea
            className="textarea"
            rows={7}
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSelected(null);
            }}
            placeholder="Paste EXPLAIN output here…"
          />
        </div>
      </Card>

      {parsed.error ? (
        <Card>
          <div className="card-body">
            <div className="empty">
              <div className="empty__title">Couldn't parse that plan</div>
              <p>{parsed.error}</p>
              <p style={{ fontSize: "0.85rem" }}>
                Expected: {PLAN_ENGINES.find((p) => p.id === engine)?.format}
              </p>
            </div>
          </div>
        </Card>
      ) : parsed.plan && summary ? (
        <>
          <div className="metrics-row">
            <div className="metric">
              <div className="metric__value">{summary.nodeCount}</div>
              <div className="metric__label">Plan nodes</div>
            </div>
            <div className="metric">
              <div className="metric__value">
                {summary.totalCost != null ? summary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "–"}
              </div>
              <div className="metric__label">Total cost</div>
            </div>
            <div className="metric">
              <div className="metric__value">{summary.costliestOperation ?? "–"}</div>
              <div className="metric__label">Hottest operation</div>
            </div>
            <div className="metric" style={summary.badEstimateCount > 0 ? { background: "var(--pink-200)" } : undefined}>
              <div className="metric__value">{summary.badEstimateCount}</div>
              <div className="metric__label">Bad row estimates (&gt;10×)</div>
            </div>
          </div>

          <Card>
            <div className="card-head">
              <span className="panel-title">Execution plan</span>
              <div className="toolbar">
                {parsed.plan.hasActual ? (
                  <Badge tone="ok">Has actual (ANALYZE) data</Badge>
                ) : (
                  <Badge tone="medium">Estimates only</Badge>
                )}
                <LegendChip />
              </div>
            </div>
            <div className="card-body card-body--flush">
              <PlanTree plan={parsed.plan} selectedId={selected?.id} onSelect={setSelected} />
            </div>
            {parsed.plan.warnings.length > 0 && (
              <div className="plan-warnings">
                {parsed.plan.warnings.map((w, i) => (
                  <div key={i} className="plan-warning">
                    ⓘ {w}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {selected && <NodeDetail node={selected} plan={parsed.plan} onClose={() => setSelected(null)} />}
        </>
      ) : null}
    </div>
  );
}

function LegendChip() {
  return (
    <div className="legend">
      <span className="legend__label">Cost</span>
      <span className="legend__gradient" />
      <span className="legend__ends">low → high</span>
    </div>
  );
}

function NodeDetail({ node, plan, onClose }: { node: PlanNode; plan: ParsedPlan; onClose: () => void }) {
  const err = rowEstimateError(node);
  const rows: [string, string | undefined][] = [
    ["Operation", node.operation],
    ["Engine label", node.rawOperation],
    ["Relation", node.relation],
    ["Detail", node.detail],
    ["Estimated rows", node.estimatedRows?.toLocaleString()],
    ["Actual rows", node.actualRows?.toLocaleString()],
    ["Row-estimate error", err != null ? `${err.toFixed(1)}×` : undefined],
    ["Subtree cost", node.estimatedCost?.toLocaleString(undefined, { maximumFractionDigits: 2 })],
    ["Self cost", node.selfCost?.toLocaleString(undefined, { maximumFractionDigits: 2 })],
    [
      "Cost share",
      node.selfCost != null && plan.totalCost
        ? `${((node.selfCost / plan.totalCost) * 100).toFixed(1)}%`
        : undefined,
    ],
    ["Actual time", node.actualTimeMs != null ? `${node.actualTimeMs} ms` : undefined],
    ["Loops", node.loops?.toLocaleString()],
  ];
  return (
    <Card>
      <div className="card-head">
        <span className="panel-title">Node · {node.operation}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="card-body">
        <dl className="detail-grid">
          {rows
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => (
              <div className="detail-row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        {err != null && err >= 10 && (
          <div className="detail-callout">
            The planner expected {node.estimatedRows?.toLocaleString()} rows but saw{" "}
            {node.actualRows?.toLocaleString()} — a {err.toFixed(0)}× miss. Stale statistics or a
            skewed/correlated predicate can cause this; try refreshing statistics (ANALYZE) or
            rewriting the predicate.
          </div>
        )}
      </div>
    </Card>
  );
}
