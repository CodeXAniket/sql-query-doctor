import { Parser } from "node-sql-parser";
import type { Dialect } from "../analyzer/types";

const parser = new Parser();

export interface ParseResult {
  ast: unknown[] | null;
  error?: string;
}

/**
 * Best-effort multi-dialect parse. The analyzer's rules are text-driven and do
 * not depend on a successful parse, but a clean AST lets us confirm the query
 * is well-formed and is reused by AST-aware rules. A parse failure is captured,
 * not thrown, so linting still runs on unparseable-but-lintable SQL.
 */
export function parseSql(sql: string, dialect: Dialect): ParseResult {
  const trimmed = sql.trim();
  if (!trimmed) return { ast: null };
  try {
    const ast = parser.astify(trimmed, { database: dialect });
    return { ast: Array.isArray(ast) ? ast : [ast] };
  } catch (err) {
    return { ast: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** True when the given SQL parses cleanly in the given dialect. */
export function isValidSql(sql: string, dialect: Dialect): boolean {
  return parseSql(sql, dialect).error === undefined && sql.trim().length > 0;
}
