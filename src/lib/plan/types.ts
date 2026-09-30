/* =========================================================================
   Unified execution-plan model
   One shape for plans coming from PostgreSQL, MySQL, SQL Server and SQLite.
   ========================================================================= */

export type PlanEngine = "postgresql" | "mysql" | "sqlserver" | "sqlite";

export const PLAN_ENGINES: { id: PlanEngine; label: string; format: string }[] = [
  { id: "postgresql", label: "PostgreSQL", format: "EXPLAIN (FORMAT JSON)" },
  { id: "mysql", label: "MySQL", format: "EXPLAIN FORMAT=JSON" },
  { id: "sqlserver", label: "SQL Server", format: "Showplan XML" },
  { id: "sqlite", label: "SQLite", format: "EXPLAIN QUERY PLAN" },
];

export interface PlanNode {
  id: string;
  /** Normalized operation label (e.g. "Seq Scan", "Index Scan", "Hash Join"). */
  operation: string;
  /** The engine's original operation label, preserved for reference. */
  rawOperation: string;
  /** Table / index / extra descriptor shown under the operation. */
  detail?: string;
  relation?: string;
  /** Estimated rows the planner expected (per loop where applicable). */
  estimatedRows?: number;
  /** Actual rows observed (only present for ANALYZE-style plans). */
  actualRows?: number;
  /** Cumulative estimated cost for this node's subtree, engine-native units. */
  estimatedCost?: number;
  /** Self cost = subtree cost minus children's subtree cost (derived). */
  selfCost?: number;
  actualTimeMs?: number;
  loops?: number;
  children: PlanNode[];
}

export interface ParsedPlan {
  engine: PlanEngine;
  root: PlanNode;
  /** Root subtree cost, when the engine reports costs. */
  totalCost?: number;
  /** True when actual (measured) row/time data is present. */
  hasActual: boolean;
  warnings: string[];
}

export class PlanParseError extends Error {
  constructor(
    message: string,
    public readonly engine: PlanEngine,
  ) {
    super(message);
    this.name = "PlanParseError";
  }
}
