import type { AnalysisResult, Dialect, Finding, Rule, Severity } from "./types";
import { SEVERITY_ORDER } from "./types";
import { buildContext, toRange } from "./context";
import { ALL_RULES } from "./rules";

/** Run a single rule against a context and resolve its detections to findings. */
export function runRule(rule: Rule, ctx: ReturnType<typeof buildContext>): Finding[] {
  if (rule.dialects && !rule.dialects.includes(ctx.dialect)) return [];
  const detections = rule.detect(ctx);
  return detections.map((d) => {
    const range = toRange(ctx.raw, d.index, d.length);
    return {
      ...range,
      ruleId: rule.id,
      title: rule.title,
      category: rule.category,
      severity: d.severity ?? rule.severity,
      message: d.message,
      explanation: d.explanation ?? rule.explanation,
      suggestion: d.suggestion ?? rule.suggestion,
      fix: d.fix,
      snippet: ctx.raw.slice(d.index, d.index + d.length).trim(),
    } satisfies Finding;
  });
}

export interface AnalyzeOptions {
  rules?: Rule[];
}

/**
 * Analyze a SQL string in a given dialect and return all findings, sorted by
 * source position (then severity). Deduplicates identical (rule, index) hits.
 */
export function analyzeSql(
  sql: string,
  dialect: Dialect,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const ctx = buildContext(sql, dialect);
  const rules = options.rules ?? ALL_RULES;

  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    for (const f of runRule(rule, ctx)) {
      const key = `${f.ruleId}@${f.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  }

  findings.sort(
    (a, b) => a.index - b.index || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;

  return {
    dialect,
    findings,
    parseError: ctx.parseError,
    counts,
    firedRules: [...new Set(findings.map((f) => f.ruleId))],
  };
}
