/* =========================================================================
   Analyzer type model
   ========================================================================= */

export type Dialect = "postgresql" | "mysql" | "transactsql" | "sqlite";

export const DIALECTS: { id: Dialect; label: string; short: string }[] = [
  { id: "postgresql", label: "PostgreSQL", short: "PG" },
  { id: "mysql", label: "MySQL", short: "MY" },
  { id: "transactsql", label: "SQL Server", short: "MS" },
  { id: "sqlite", label: "SQLite", short: "LT" },
];

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type Category =
  | "index-usage"
  | "full-scan"
  | "projection"
  | "anti-join"
  | "sorting"
  | "pagination"
  | "set-op"
  | "correctness";

export const CATEGORY_LABELS: Record<Category, string> = {
  "index-usage": "Index usage",
  "full-scan": "Full scan",
  projection: "Projection",
  "anti-join": "Join / subquery",
  sorting: "Sorting",
  pagination: "Pagination",
  "set-op": "Set operation",
  correctness: "Correctness",
};

/** A location in the source, 1-based line & column. */
export interface SourceRange {
  index: number;
  length: number;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/** What a rule's `detect` returns — a raw hit before rule metadata is merged. */
export interface Detection {
  index: number;
  length: number;
  /** Short, specific message about this occurrence. */
  message: string;
  /** Optional per-occurrence overrides of the rule defaults. */
  explanation?: string;
  suggestion?: string;
  fix?: string;
  severity?: Severity;
}

/** A fully-resolved finding shown in the UI. */
export interface Finding extends SourceRange {
  ruleId: string;
  title: string;
  category: Category;
  severity: Severity;
  message: string;
  explanation: string;
  suggestion: string;
  fix?: string;
  snippet: string;
}

/** Context handed to every rule. */
export interface SqlContext {
  /** Original, untouched SQL. */
  raw: string;
  /**
   * SQL with string literals and comments blanked to spaces (length-preserved),
   * so structural keyword scans never match inside strings/comments.
   */
  masked: string;
  /** `masked` lower-cased, for case-insensitive keyword search. */
  lower: string;
  /** Per-character flag: true when the char is "code" (not string/comment). */
  codeMask: boolean[];
  dialect: Dialect;
  /** Parsed AST statements, or null if parsing failed. */
  ast: unknown[] | null;
  parseError?: string;
}

export interface Rule {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  /** One-line description for the rules catalog. */
  summary: string;
  /** Default "why it's slow" text. */
  explanation: string;
  /** Default "how to fix" text. */
  suggestion: string;
  /** Dialects this rule applies to; omitted => all dialects. */
  dialects?: Dialect[];
  detect(ctx: SqlContext): Detection[];
}

export interface AnalysisResult {
  dialect: Dialect;
  findings: Finding[];
  parseError?: string;
  /** Count of findings per severity, for the summary header. */
  counts: Record<Severity, number>;
  /** Rule ids that fired at least once. */
  firedRules: string[];
}
