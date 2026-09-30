import type { ParsedPlan, PlanEngine } from "./types";
import { PlanParseError } from "./types";
import { parsePostgres } from "./parsers/postgres";
import { parseMysql } from "./parsers/mysql";
import { parseSqlServer } from "./parsers/sqlserver";
import { parseSqlite } from "./parsers/sqlite";

/** Parse EXPLAIN output for a specific engine into the unified plan model. */
export function parsePlan(text: string, engine: PlanEngine): ParsedPlan {
  const trimmed = text.trim();
  if (!trimmed) throw new PlanParseError("No plan text provided.", engine);
  switch (engine) {
    case "postgresql":
      return parsePostgres(trimmed);
    case "mysql":
      return parseMysql(trimmed);
    case "sqlserver":
      return parseSqlServer(trimmed);
    case "sqlite":
      return parseSqlite(trimmed);
  }
}

/**
 * Best-effort auto-detection of the source engine from the pasted text, used to
 * pre-select the engine dropdown. Falls back to postgresql.
 */
export function detectEngine(text: string): PlanEngine {
  const t = text.trim();
  if (t.startsWith("<") && /RelOp|ShowPlanXML/i.test(t)) return "sqlserver";
  if (t.startsWith("{") || t.startsWith("[")) {
    if (/query_block/.test(t)) return "mysql";
    if (/Node Type|QUERY PLAN|"Plan"/.test(t)) return "postgresql";
    return "postgresql";
  }
  if (/\|--|`--/.test(t) || /^\s*\d+\|\d+\|/m.test(t)) return "sqlite";
  if (/\(cost=[\d.]+\.\.[\d.]+\s+rows=/.test(t)) return "postgresql";
  return "postgresql";
}
