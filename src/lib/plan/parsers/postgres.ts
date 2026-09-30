import type { ParsedPlan, PlanNode } from "../types";
import { PlanParseError } from "../types";
import { computeSelfCosts } from "../metrics";

let counter = 0;
const nextId = () => `pg_${counter++}`;

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildDetail(raw: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  if (raw["Relation Name"]) {
    const rel = String(raw["Relation Name"]);
    const alias = raw["Alias"] && raw["Alias"] !== rel ? ` (${raw["Alias"]})` : "";
    parts.push(`on ${rel}${alias}`);
  }
  if (raw["Index Name"]) parts.push(`using ${raw["Index Name"]}`);
  for (const key of ["Index Cond", "Recheck Cond", "Hash Cond", "Merge Cond", "Join Filter", "Filter"]) {
    if (raw[key]) parts.push(`${key.toLowerCase()}: ${String(raw[key])}`);
  }
  if (raw["Sort Key"]) parts.push(`sort key: ${(raw["Sort Key"] as string[]).join(", ")}`);
  if (raw["Group Key"]) parts.push(`group key: ${(raw["Group Key"] as string[]).join(", ")}`);
  return parts.length ? parts.join("  ·  ") : undefined;
}

function normalizeNode(raw: Record<string, unknown>): PlanNode {
  const nodeType = String(raw["Node Type"] ?? "Unknown");
  const joinType = raw["Join Type"] ? `${raw["Join Type"]} ` : "";
  const operation =
    nodeType.includes("Join") && raw["Join Type"] ? `${joinType}${nodeType}`.trim() : nodeType;
  const childrenRaw = (raw["Plans"] as Record<string, unknown>[] | undefined) ?? [];
  return {
    id: nextId(),
    operation,
    rawOperation: nodeType,
    detail: buildDetail(raw),
    relation: raw["Relation Name"] ? String(raw["Relation Name"]) : undefined,
    estimatedRows: num(raw["Plan Rows"]),
    actualRows: num(raw["Actual Rows"]),
    estimatedCost: num(raw["Total Cost"]),
    actualTimeMs: num(raw["Actual Total Time"]),
    loops: num(raw["Actual Loops"]),
    children: childrenRaw.map(normalizeNode),
  };
}

/** Unwrap the many shapes PG EXPLAIN JSON can arrive in. */
function extractPlanObject(parsed: unknown): Record<string, unknown> {
  let p: unknown = parsed;
  if (Array.isArray(p)) p = p[0];
  if (p && typeof p === "object") {
    const obj = p as Record<string, unknown>;
    if (obj["QUERY PLAN"]) return extractPlanObject(obj["QUERY PLAN"]);
    if (obj["Plan"]) return obj["Plan"] as Record<string, unknown>;
    if (obj["Node Type"]) return obj;
  }
  throw new PlanParseError("Could not find a Plan object in the JSON.", "postgresql");
}

export function parsePostgresJson(text: string): ParsedPlan {
  counter = 0;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PlanParseError("Invalid JSON. Use EXPLAIN (FORMAT JSON).", "postgresql");
  }
  const planObj = extractPlanObject(parsed);
  const root = computeSelfCosts(normalizeNode(planObj));
  const hasActual = root.actualRows != null || root.actualTimeMs != null;
  return { engine: "postgresql", root, totalCost: root.estimatedCost, hasActual, warnings: [] };
}

/* -------------------------------------------------------------------------
   Text-format parser: the default `EXPLAIN` / `EXPLAIN ANALYZE` output.
   ------------------------------------------------------------------------- */

const COST_RE = /\(cost=[\d.]+\.\.([\d.]+)\s+rows=(\d+)\s+width=\d+\)/;
const ACTUAL_RE = /\(actual time=[\d.]+\.\.([\d.]+)\s+rows=(\d+)\s+loops=(\d+)\)/;

interface TextLine {
  indent: number;
  text: string;
}

export function parsePostgresText(text: string): ParsedPlan {
  counter = 0;
  const rawLines = text.split("\n").filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) throw new PlanParseError("Empty plan.", "postgresql");

  // Each node line either starts a plan (first line) or begins with "->".
  // Detail lines (Filter:, Index Cond:, etc.) attach to the previous node.
  const lines: TextLine[] = rawLines.map((l) => {
    const indent = l.length - l.trimStart().length;
    return { indent, text: l.trim() };
  });

  const root = parseTextNode(lines, { i: 0 }, -1);
  if (!root) throw new PlanParseError("Could not parse plan text.", "postgresql");
  computeSelfCosts(root);
  const hasActual = ACTUAL_RE.test(text);
  return { engine: "postgresql", root, totalCost: root.estimatedCost, hasActual, warnings: [] };
}

function nodeIndent(line: TextLine): number {
  // The arrow "->" marks a child; its logical indent is the arrow position.
  return line.indent;
}

function parseTextNode(
  lines: TextLine[],
  cursor: { i: number },
  parentIndent: number,
): PlanNode | null {
  if (cursor.i >= lines.length) return null;
  const line = lines[cursor.i];
  const isArrow = line.text.startsWith("->");
  const opText = isArrow ? line.text.slice(2).trim() : line.text;
  const myIndent = nodeIndent(line);
  if (parentIndent >= 0 && myIndent <= parentIndent) return null;

  cursor.i++;
  const node = makeTextNode(opText);

  // Consume attached detail lines (deeper indent, not an arrow) and children.
  while (cursor.i < lines.length) {
    const next = lines[cursor.i];
    if (next.indent <= myIndent) break;
    if (next.text.startsWith("->")) {
      const child = parseTextNode(lines, cursor, myIndent);
      if (child) node.children.push(child);
      else break;
    } else {
      // Detail line
      node.detail = node.detail ? `${node.detail}  ·  ${next.text}` : next.text;
      cursor.i++;
    }
  }
  return node;
}

function makeTextNode(opText: string): PlanNode {
  const costMatch = opText.match(COST_RE);
  const actualMatch = opText.match(ACTUAL_RE);
  const opLabel = opText.replace(COST_RE, "").replace(ACTUAL_RE, "").trim();
  const relMatch = opLabel.match(/\bon\s+([a-zA-Z_][\w.]*)/);
  return {
    id: nextId(),
    operation: opLabel.split("  ")[0].trim() || opLabel,
    rawOperation: opLabel,
    relation: relMatch?.[1],
    estimatedCost: costMatch ? Number(costMatch[1]) : undefined,
    estimatedRows: costMatch ? Number(costMatch[2]) : undefined,
    actualTimeMs: actualMatch ? Number(actualMatch[1]) : undefined,
    actualRows: actualMatch ? Number(actualMatch[2]) : undefined,
    loops: actualMatch ? Number(actualMatch[3]) : undefined,
    children: [],
  };
}

/** Parse either JSON or text PostgreSQL EXPLAIN output (auto-detected). */
export function parsePostgres(text: string): ParsedPlan {
  const t = text.trim();
  if (t.startsWith("[") || t.startsWith("{")) return parsePostgresJson(t);
  return parsePostgresText(t);
}
