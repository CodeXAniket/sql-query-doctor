import { describe, it, expect } from "vitest";
import {
  rowEstimateError,
  isRowEstimateBad,
  computeSelfCosts,
  maxSelfCost,
  costliestNode,
  costShare,
  summarizePlan,
  flatten,
  ROW_ERROR_THRESHOLD,
} from "../metrics";
import type { PlanNode, ParsedPlan } from "../types";
import { parsePlan } from "../parse";
import { PLAN_SAMPLES } from "../samples";

function leaf(partial: Partial<PlanNode>): PlanNode {
  return {
    id: partial.id ?? "n",
    operation: partial.operation ?? "Op",
    rawOperation: partial.rawOperation ?? "Op",
    children: partial.children ?? [],
    ...partial,
  };
}

describe("rowEstimateError", () => {
  it("returns null when actual data is missing", () => {
    expect(rowEstimateError(leaf({ estimatedRows: 100 }))).toBeNull();
  });
  it("computes under-estimate factor", () => {
    expect(rowEstimateError(leaf({ estimatedRows: 100, actualRows: 1000 }))).toBe(10);
  });
  it("computes over-estimate factor symmetrically", () => {
    expect(rowEstimateError(leaf({ estimatedRows: 1000, actualRows: 100 }))).toBe(10);
  });
  it("clamps zero rows to avoid division blow-up", () => {
    expect(rowEstimateError(leaf({ estimatedRows: 0, actualRows: 0 }))).toBe(1);
  });
  it("flags errors at or above the 10x threshold", () => {
    expect(isRowEstimateBad(leaf({ estimatedRows: 10, actualRows: 100 }))).toBe(true);
    expect(isRowEstimateBad(leaf({ estimatedRows: 10, actualRows: 50 }))).toBe(false);
    expect(ROW_ERROR_THRESHOLD).toBe(10);
  });
});

describe("computeSelfCosts", () => {
  it("subtracts children subtree cost from the parent", () => {
    const root = leaf({
      estimatedCost: 100,
      children: [leaf({ estimatedCost: 30 }), leaf({ estimatedCost: 25 })],
    });
    computeSelfCosts(root);
    expect(root.selfCost).toBe(45);
    expect(root.children[0].selfCost).toBe(30);
  });
  it("never produces a negative self cost", () => {
    const root = leaf({ estimatedCost: 10, children: [leaf({ estimatedCost: 50 })] });
    computeSelfCosts(root);
    expect(root.selfCost).toBe(0);
  });
  it("leaves self cost undefined when cost is missing", () => {
    const root = leaf({ children: [leaf({ estimatedCost: 5 })] });
    computeSelfCosts(root);
    expect(root.selfCost).toBeUndefined();
  });
});

describe("cost helpers", () => {
  const root = computeSelfCosts(
    leaf({
      operation: "Root",
      estimatedCost: 100,
      children: [leaf({ operation: "Big", estimatedCost: 80 }), leaf({ operation: "Small", estimatedCost: 5 })],
    }),
  );

  it("finds the maximum self cost", () => {
    expect(maxSelfCost(root)).toBe(80);
  });
  it("identifies the costliest node", () => {
    expect(costliestNode(root)?.operation).toBe("Big");
  });
  it("computes a cost share fraction", () => {
    const plan: ParsedPlan = { engine: "postgresql", root, totalCost: 100, hasActual: false, warnings: [] };
    const big = flatten(root).find((n) => n.operation === "Big")!;
    expect(costShare(big, plan)).toBe(0.8);
  });
});

describe("summarizePlan", () => {
  it("summarizes the PostgreSQL sample", () => {
    const plan = parsePlan(PLAN_SAMPLES.postgresql, "postgresql");
    const s = summarizePlan(plan);
    expect(s.nodeCount).toBe(5);
    expect(s.hasActual).toBe(true);
    expect(s.badEstimateCount).toBeGreaterThanOrEqual(1); // the 500 vs 8200 join
    expect(s.maxRowError).toBeGreaterThan(10);
  });
  it("handles plans without actual data", () => {
    const plan = parsePlan(PLAN_SAMPLES.mysql, "mysql");
    const s = summarizePlan(plan);
    expect(s.hasActual).toBe(false);
    expect(s.badEstimateCount).toBe(0);
  });
});

describe("flatten", () => {
  it("returns nodes depth-first including the root", () => {
    const root = leaf({ operation: "A", children: [leaf({ operation: "B" }), leaf({ operation: "C" })] });
    expect(flatten(root).map((n) => n.operation)).toEqual(["A", "B", "C"]);
  });
});
