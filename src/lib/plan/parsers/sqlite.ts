import type { ParsedPlan, PlanNode } from "../types";
import { PlanParseError } from "../types";

let counter = 0;
const nextId = () => `lt_${counter++}`;

function makeNode(detail: string): PlanNode {
  const opMatch = detail.match(/^(SCAN|SEARCH|USE|USING|COMPOUND|MERGE|LIST|CORRELATED)/i);
  let operation = detail.split(/\s+/).slice(0, 2).join(" ");
  if (opMatch) {
    const kw = opMatch[1].toUpperCase();
    if (kw === "SCAN") operation = "Scan";
    else if (kw === "SEARCH") operation = "Search";
    else if (kw === "USE") operation = "Use Temp B-Tree";
  }
  const relMatch = detail.match(/^(?:SCAN|SEARCH)\s+(?:TABLE\s+)?([A-Za-z_]\w*)/i);
  const usesIndex = /USING\s+(?:COVERING\s+)?INDEX/i.test(detail);
  return {
    id: nextId(),
    operation: usesIndex && operation === "Search" ? "Index Search" : operation,
    rawOperation: detail,
    detail,
    relation: relMatch?.[1],
    children: [],
  };
}

/** Parse the pretty tree form (|-- / `-- connectors, 3-char indent groups). */
function parsePretty(lines: string[]): PlanNode {
  const root: PlanNode = {
    id: nextId(),
    operation: "QUERY PLAN",
    rawOperation: "QUERY PLAN",
    children: [],
  };
  // stack[depth] = the node whose children the next deeper node joins.
  const stack: PlanNode[] = [root];
  for (const line of lines) {
    const dashIdx = line.indexOf("--");
    if (dashIdx === -1) continue;
    const depth = Math.floor(dashIdx / 3);
    const detail = line.slice(dashIdx + 2).trim();
    if (!detail) continue;
    const node = makeNode(detail);
    const parent = stack[depth] ?? root;
    parent.children.push(node);
    stack[depth + 1] = node;
    stack.length = depth + 2; // drop deeper stale entries
  }
  return root;
}

/** Parse the tabular form: id|parent|notused|detail. */
function parseTabular(lines: string[]): PlanNode {
  const root: PlanNode = {
    id: "lt_root",
    operation: "QUERY PLAN",
    rawOperation: "QUERY PLAN",
    children: [],
  };
  const byId = new Map<number, PlanNode>();
  const parentOf = new Map<number, number>();
  for (const line of lines) {
    const cols = line.split("|");
    if (cols.length < 4) continue;
    const id = Number(cols[0]);
    const parent = Number(cols[1]);
    if (!Number.isFinite(id)) continue;
    const detail = cols.slice(3).join("|").trim();
    const node = makeNode(detail);
    byId.set(id, node);
    parentOf.set(id, parent);
  }
  for (const [id, node] of byId) {
    const parent = parentOf.get(id) ?? 0;
    const parentNode = parent && byId.has(parent) ? byId.get(parent)! : root;
    parentNode.children.push(node);
  }
  return root;
}

export function parseSqlite(text: string): ParsedPlan {
  counter = 0;
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0 && l.trim().toUpperCase() !== "QUERY PLAN")
    .filter((l) => !/^id\s*\|\s*parent/i.test(l.trim())); // drop a header row

  if (lines.length === 0) throw new PlanParseError("Empty query plan.", "sqlite");

  const looksTabular = lines.every((l) => /^\s*\d+\s*\|/.test(l));
  const root = looksTabular ? parseTabular(lines) : parsePretty(lines);

  if (root.children.length === 0) {
    throw new PlanParseError("Could not parse EXPLAIN QUERY PLAN output.", "sqlite");
  }
  // Collapse a single-child synthetic root for a cleaner tree.
  const effectiveRoot = root.children.length === 1 ? root.children[0] : root;
  return {
    engine: "sqlite",
    root: effectiveRoot,
    totalCost: undefined,
    hasActual: false,
    warnings: ["SQLite EXPLAIN QUERY PLAN has no cost or row estimates; showing structure only."],
  };
}
