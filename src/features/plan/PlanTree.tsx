import { useMemo } from "react";
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { scaleSqrt } from "d3-scale";
import type { ParsedPlan, PlanNode } from "../../lib/plan/types";
import {
  maxSelfCost,
  costliestNode,
  rowEstimateError,
  isRowEstimateBad,
} from "../../lib/plan/metrics";

const NODE_W = 190;
const NODE_H = 78;
const GAP_X = 26;
const GAP_Y = 56;

function fmtRows(n?: number): string {
  if (n == null) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function PlanTree({
  plan,
  selectedId,
  onSelect,
}: {
  plan: ParsedPlan;
  selectedId?: string;
  onSelect?: (n: PlanNode) => void;
}) {
  const { nodes, links, width, height, hottestId } = useMemo(() => {
    const root = hierarchy(plan.root, (d) => d.children);
    const layout = tree<PlanNode>().nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y]);
    layout(root);

    const pts = root.descendants() as HierarchyPointNode<PlanNode>[];
    const xs = pts.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const maxDepth = Math.max(...pts.map((p) => p.depth));
    const offsetX = -minX + GAP_X;

    const positioned = pts.map((p) => ({
      node: p.data,
      x: p.x + offsetX,
      y: p.depth * (NODE_H + GAP_Y) + GAP_Y,
    }));

    const linkPaths = (root.links() as { source: HierarchyPointNode<PlanNode>; target: HierarchyPointNode<PlanNode> }[]).map(
      (l) => {
        const sx = l.source.x + offsetX + NODE_W / 2;
        const sy = l.source.depth * (NODE_H + GAP_Y) + GAP_Y + NODE_H;
        const tx = l.target.x + offsetX + NODE_W / 2;
        const ty = l.target.depth * (NODE_H + GAP_Y) + GAP_Y;
        const my = (sy + ty) / 2;
        return {
          id: `${l.source.data.id}-${l.target.data.id}`,
          d: `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`,
        };
      },
    );

    return {
      nodes: positioned,
      links: linkPaths,
      width: maxX - minX + NODE_W + GAP_X * 2,
      height: (maxDepth + 1) * (NODE_H + GAP_Y) + GAP_Y,
      hottestId: costliestNode(plan.root)?.id,
    };
  }, [plan]);

  const max = maxSelfCost(plan.root);
  const heat = scaleSqrt<number, number>().domain([0, max || 1]).range([0, 1]);

  const nodeFill = (n: PlanNode): string => {
    if (n.selfCost == null || max === 0) return "var(--surface)";
    const t = heat(n.selfCost);
    // Keep the low end readable (light) and ramp to hot.
    return interpolateYlOrRd(0.15 + t * 0.75);
  };

  return (
    <div className="plan-scroll">
      <div className="plan-canvas" style={{ width, height }}>
        <svg className="plan-links" width={width} height={height} aria-hidden>
          {links.map((l) => (
            <path key={l.id} d={l.d} className="plan-link" />
          ))}
        </svg>

        {nodes.map(({ node, x, y }) => {
          const bad = isRowEstimateBad(node);
          const err = rowEstimateError(node);
          const isHot = node.id === hottestId && node.selfCost != null && max > 0;
          const fill = nodeFill(node);
          const dark = node.selfCost != null && max > 0 && heat(node.selfCost) > 0.55;
          return (
            <button
              key={node.id}
              className={[
                "plan-node",
                selectedId === node.id && "plan-node--selected",
                bad && "plan-node--bad",
                dark && "plan-node--dark",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: x, top: y, width: NODE_W, height: NODE_H, background: fill }}
              onClick={() => onSelect?.(node)}
            >
              {isHot && <span className="plan-node__flag plan-node__flag--hot">HOT</span>}
              {bad && (
                <span className="plan-node__flag plan-node__flag--bad">
                  ⚠ {err && err >= 100 ? `${Math.round(err)}×` : `${err?.toFixed(0)}×`}
                </span>
              )}
              <span className="plan-node__op">{node.operation}</span>
              {node.relation && <span className="plan-node__rel">{node.relation}</span>}
              <span className="plan-node__rows">
                est {fmtRows(node.estimatedRows)}
                {node.actualRows != null && ` · act ${fmtRows(node.actualRows)}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
