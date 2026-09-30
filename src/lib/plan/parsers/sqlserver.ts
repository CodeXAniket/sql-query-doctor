import { XMLParser } from "fast-xml-parser";
import type { ParsedPlan, PlanNode } from "../types";
import { PlanParseError } from "../types";
import { computeSelfCosts, flatten } from "../metrics";

let counter = 0;
const nextId = () => `ms_${counter++}`;

type Obj = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
});

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Find the shallowest RelOp descendants of a value (the direct children in the
 * logical plan tree). Recurses through wrapper elements but never descends past
 * a RelOp it finds.
 */
function shallowRelOps(value: unknown): Obj[] {
  const found: Obj[] = [];
  const visit = (v: unknown) => {
    if (v == null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    for (const [k, child] of Object.entries(v as Obj)) {
      if (k === "RelOp") {
        found.push(...asArray(child as Obj | Obj[]));
      } else if (typeof child === "object") {
        visit(child);
      }
    }
  };
  visit(value);
  return found;
}

/** The RunTimeInformation actual-rows sum, if present (STATISTICS XML). */
function actualRows(relOp: Obj): number | undefined {
  let total: number | undefined;
  const visit = (v: unknown) => {
    if (v == null || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(visit);
    for (const [k, child] of Object.entries(v as Obj)) {
      if (k === "RunTimeCountersPerThread") {
        for (const counters of asArray(child as Obj | Obj[])) {
          const rows = num(counters["@_ActualRows"]);
          if (rows != null) total = (total ?? 0) + rows;
        }
      } else if (k !== "RelOp" && typeof child === "object") {
        visit(child);
      }
    }
  };
  visit(relOp);
  return total;
}

function describe(relOp: Obj): string | undefined {
  // Look for an Object element (index/table reference) in the physical-op child.
  const parts: string[] = [];
  const visit = (v: unknown, depth: number) => {
    if (v == null || typeof v !== "object" || depth > 4) return;
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth));
    const o = v as Obj;
    if (o["@_Table"] || o["@_Index"]) {
      const tbl = o["@_Table"] ? String(o["@_Table"]).replace(/[[\]]/g, "") : "";
      const idx = o["@_Index"] ? String(o["@_Index"]).replace(/[[\]]/g, "") : "";
      const label = [tbl, idx].filter(Boolean).join(".");
      if (label && !parts.includes(label)) parts.push(label);
    }
    for (const [k, child] of Object.entries(o)) {
      if (k !== "RelOp" && typeof child === "object") visit(child, depth + 1);
    }
  };
  visit(relOp, 0);
  return parts.length ? `on ${parts.join(", ")}` : undefined;
}

function normalizeRelOp(relOp: Obj): PlanNode {
  const physicalOp = String(relOp["@_PhysicalOp"] ?? "Unknown");
  const logicalOp = relOp["@_LogicalOp"] ? String(relOp["@_LogicalOp"]) : undefined;
  const subtreeCost = num(relOp["@_EstimatedTotalSubtreeCost"]);
  const est = num(relOp["@_EstimateRows"]);
  const children = shallowRelOps(relOp).map(normalizeRelOp);
  return {
    id: nextId(),
    operation: physicalOp,
    rawOperation: logicalOp ? `${physicalOp} (${logicalOp})` : physicalOp,
    detail: describe(relOp),
    estimatedRows: est,
    actualRows: actualRows(relOp),
    estimatedCost: subtreeCost,
    children,
  };
}

export function parseSqlServer(text: string): ParsedPlan {
  counter = 0;
  let doc: Obj;
  try {
    doc = parser.parse(text) as Obj;
  } catch {
    throw new PlanParseError("Invalid XML showplan.", "sqlserver");
  }
  // The top RelOp lives under ShowPlanXML > ... > QueryPlan > RelOp.
  const tops = shallowRelOps(doc);
  if (tops.length === 0) {
    throw new PlanParseError("No <RelOp> elements found — not a showplan XML.", "sqlserver");
  }
  const root = computeSelfCosts(normalizeRelOp(tops[0]));
  // Actual (STATISTICS XML) data can live on any node, not just the root.
  const hasActual = flatten(root).some((n) => n.actualRows != null);
  return {
    engine: "sqlserver",
    root,
    totalCost: root.estimatedCost,
    hasActual,
    warnings: tops.length > 1 ? ["Multiple statements found; showing the first."] : [],
  };
}
