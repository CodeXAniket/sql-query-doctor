import type { PlanNode, ParsedPlan } from "./types";

/** Row-estimate error factor for a node: max(est/act, act/est), or null. */
export function rowEstimateError(node: PlanNode): number | null {
  const est = node.estimatedRows;
  const act = node.actualRows;
  if (est == null || act == null) return null;
  // Clamp to at least 1 row so a 0-vs-1 comparison doesn't blow up.
  const e = Math.max(est, 1);
  const a = Math.max(act, 1);
  return Math.max(e / a, a / e);
}

/** Threshold above which a row-estimate error is considered significant (10x). */
export const ROW_ERROR_THRESHOLD = 10;

export function isRowEstimateBad(node: PlanNode): boolean {
  const err = rowEstimateError(node);
  return err !== null && err >= ROW_ERROR_THRESHOLD;
}

/** Walk the tree depth-first (root first). */
export function walk(node: PlanNode, visit: (n: PlanNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  for (const c of node.children) walk(c, visit, depth + 1);
}

export function flatten(node: PlanNode): PlanNode[] {
  const out: PlanNode[] = [];
  walk(node, (n) => out.push(n));
  return out;
}

/**
 * Compute `selfCost` for every node = its subtree cost minus the sum of its
 * children's subtree costs. Mutates nodes in place and returns the root.
 */
export function computeSelfCosts(root: PlanNode): PlanNode {
  walk(root, (n) => {
    if (n.estimatedCost == null) {
      n.selfCost = undefined;
      return;
    }
    const childCost = n.children.reduce((s, c) => s + (c.estimatedCost ?? 0), 0);
    n.selfCost = Math.max(0, n.estimatedCost - childCost);
  });
  return root;
}

/** The maximum self cost across the plan (for heat-scale normalization). */
export function maxSelfCost(root: PlanNode): number {
  let max = 0;
  walk(root, (n) => {
    if (n.selfCost != null) max = Math.max(max, n.selfCost);
  });
  return max;
}

/** The single costliest node by self cost (the bottleneck). */
export function costliestNode(root: PlanNode): PlanNode | null {
  let best: PlanNode | null = null;
  walk(root, (n) => {
    if (n.selfCost == null) return;
    if (best === null || n.selfCost > (best.selfCost ?? 0)) best = n;
  });
  return best;
}

/** Fraction (0..1) of total plan cost attributable to a node's self cost. */
export function costShare(node: PlanNode, plan: ParsedPlan): number {
  if (node.selfCost == null || !plan.totalCost) return 0;
  return node.selfCost / plan.totalCost;
}

/** Summary metrics for the header strip above a rendered plan. */
export interface PlanSummary {
  nodeCount: number;
  totalCost?: number;
  hasActual: boolean;
  badEstimateCount: number;
  costliestOperation?: string;
  maxRowError?: number;
}

export function summarizePlan(plan: ParsedPlan): PlanSummary {
  const nodes = flatten(plan.root);
  let badEstimateCount = 0;
  let maxRowError: number | undefined;
  for (const n of nodes) {
    const err = rowEstimateError(n);
    if (err !== null) {
      if (err >= 1) maxRowError = Math.max(maxRowError ?? 0, err);
      if (err >= ROW_ERROR_THRESHOLD) badEstimateCount++;
    }
  }
  const worst = costliestNode(plan.root);
  return {
    nodeCount: nodes.length,
    totalCost: plan.totalCost,
    hasActual: plan.hasActual,
    badEstimateCount,
    costliestOperation: worst?.operation,
    maxRowError,
  };
}
