import type { ParsedPlan, PlanNode } from "../types";
import { PlanParseError } from "../types";
import { computeSelfCosts } from "../metrics";

let counter = 0;
const nextId = () => `my_${counter++}`;

type Obj = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const ACCESS_LABELS: Record<string, string> = {
  ALL: "Full Table Scan",
  index: "Full Index Scan",
  range: "Index Range Scan",
  ref: "Index Lookup (ref)",
  eq_ref: "Unique Index Lookup",
  const: "Const Row",
  system: "System Row",
  fulltext: "Fulltext Search",
  index_merge: "Index Merge",
  unique_subquery: "Unique Subquery",
  index_subquery: "Index Subquery",
};

function convertTable(table: Obj): PlanNode {
  const access = String(table["access_type"] ?? "");
  const operation = ACCESS_LABELS[access] ?? access ?? "Table";
  const cost = table["cost_info"] as Obj | undefined;
  const self =
    (num(cost?.["read_cost"]) ?? 0) + (num(cost?.["eval_cost"]) ?? 0) || undefined;
  const detailParts: string[] = [];
  if (table["key"]) detailParts.push(`key: ${table["key"]}`);
  if (table["used_key_parts"])
    detailParts.push(`key parts: ${(table["used_key_parts"] as string[]).join(", ")}`);
  if (table["attached_condition"]) detailParts.push(`cond: ${table["attached_condition"]}`);

  const node: PlanNode = {
    id: nextId(),
    operation,
    rawOperation: access || "table",
    relation: table["table_name"] ? String(table["table_name"]) : undefined,
    detail: detailParts.length ? detailParts.join("  ·  ") : undefined,
    estimatedRows:
      num(table["rows_produced_per_join"]) ?? num(table["rows_examined_per_scan"]),
    estimatedCost: self,
    children: [],
  };

  const mat = table["materialized_from_subquery"] as Obj | undefined;
  if (mat?.["query_block"]) {
    node.children.push(convertQueryBlock(mat["query_block"] as Obj));
  }
  return node;
}

/** Convert the "inner" operator of a query block (whatever wrapper is present). */
function convertInner(obj: Obj): PlanNode[] {
  if (obj["ordering_operation"]) {
    const oo = obj["ordering_operation"] as Obj;
    const node: PlanNode = {
      id: nextId(),
      operation: oo["using_filesort"] ? "Sort (filesort)" : "Sort",
      rawOperation: "ordering_operation",
      children: convertInner(oo),
      estimatedCost: undefined,
    };
    return [node];
  }
  if (obj["grouping_operation"]) {
    const go = obj["grouping_operation"] as Obj;
    const node: PlanNode = {
      id: nextId(),
      operation: go["using_temporary_table"] ? "Group (temp table)" : "Group / Aggregate",
      rawOperation: "grouping_operation",
      children: convertInner(go),
    };
    return [node];
  }
  if (obj["duplicates_removal"]) {
    const dr = obj["duplicates_removal"] as Obj;
    return [
      {
        id: nextId(),
        operation: "Distinct",
        rawOperation: "duplicates_removal",
        children: convertInner(dr),
      },
    ];
  }
  if (obj["nested_loop"]) {
    const arr = obj["nested_loop"] as Obj[];
    const node: PlanNode = {
      id: nextId(),
      operation: "Nested Loop",
      rawOperation: "nested_loop",
      children: arr.map((el) => convertTable(el["table"] as Obj)),
    };
    return [node];
  }
  if (obj["table"]) {
    return [convertTable(obj["table"] as Obj)];
  }
  if (obj["union_result"]) {
    const ur = obj["union_result"] as Obj;
    const specs = (ur["query_specifications"] as Obj[] | undefined) ?? [];
    return [
      {
        id: nextId(),
        operation: "Union",
        rawOperation: "union_result",
        children: specs.map((s) => convertQueryBlock(s["query_block"] as Obj)),
      },
    ];
  }
  return [];
}

function convertQueryBlock(qb: Obj): PlanNode {
  const children = convertInner(qb);
  return {
    id: nextId(),
    operation: `Query Block${qb["select_id"] != null ? ` #${qb["select_id"]}` : ""}`,
    rawOperation: "query_block",
    estimatedCost: undefined, // wrapper: no heat; totalCost tracked separately
    children,
  };
}

export function parseMysql(text: string): ParsedPlan {
  counter = 0;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PlanParseError("Invalid JSON. Use EXPLAIN FORMAT=JSON.", "mysql");
  }
  const obj = parsed as Obj;
  const qb = obj["query_block"] as Obj | undefined;
  if (!qb) throw new PlanParseError("Missing 'query_block' — not a MySQL JSON plan.", "mysql");

  const root = computeSelfCosts(convertQueryBlock(qb));
  const queryCost = num((qb["cost_info"] as Obj | undefined)?.["query_cost"]);
  return {
    engine: "mysql",
    root,
    totalCost: queryCost,
    hasActual: false,
    warnings: queryCost
      ? []
      : ["No cost_info in this plan; heat colouring is unavailable."],
  };
}
