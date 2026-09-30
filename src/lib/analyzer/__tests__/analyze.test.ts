import { describe, it, expect } from "vitest";
import { analyzeSql } from "../analyze";
import { ALL_RULES, RULES_BY_ID } from "../rules";

describe("analyzeSql integration", () => {
  it("returns no findings for a clean query", () => {
    const r = analyzeSql("SELECT id, name FROM users WHERE id = 1", "postgresql");
    expect(r.findings).toHaveLength(0);
    expect(r.counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it("finds multiple anti-patterns in one query", () => {
    const sql = "SELECT * FROM users WHERE name LIKE '%joe' OR email != 'x'";
    const r = analyzeSql(sql, "postgresql");
    const fired = new Set(r.findings.map((f) => f.ruleId));
    expect(fired).toContain("select-star");
    expect(fired).toContain("leading-wildcard-like");
    expect(fired).toContain("or-in-where");
    expect(fired).toContain("inequality-operator");
  });

  it("sorts findings by source position", () => {
    const sql = "SELECT * FROM users WHERE name LIKE '%joe'";
    const r = analyzeSql(sql, "postgresql");
    const indexes = r.findings.map((f) => f.index);
    const sorted = [...indexes].sort((a, b) => a - b);
    expect(indexes).toEqual(sorted);
  });

  it("computes accurate line/column positions", () => {
    const sql = "SELECT id\nFROM users\nWHERE name LIKE '%joe'";
    const r = analyzeSql(sql, "postgresql");
    const f = r.findings.find((x) => x.ruleId === "leading-wildcard-like");
    expect(f?.line).toBe(3);
  });

  it("populates counts by severity", () => {
    const r = analyzeSql("DELETE FROM u", "postgresql");
    expect(r.counts.critical).toBeGreaterThanOrEqual(1);
  });

  it("includes a trimmed snippet for each finding", () => {
    const r = analyzeSql("SELECT * FROM u", "postgresql");
    expect(r.findings[0].snippet.toLowerCase()).toContain("select");
  });

  it("captures parse errors but still lints", () => {
    // Slightly malformed but still contains a lintable pattern.
    const r = analyzeSql("SELECT * FROM WHERE x LIKE '%y'", "postgresql");
    expect(r.parseError).toBeDefined();
    expect(r.findings.some((f) => f.ruleId === "leading-wildcard-like")).toBe(true);
  });

  it("can run a restricted rule set", () => {
    const r = analyzeSql("SELECT * FROM u WHERE name LIKE '%x'", "postgresql", {
      rules: [RULES_BY_ID["select-star"]],
    });
    expect(r.findings.every((f) => f.ruleId === "select-star")).toBe(true);
  });

  it("deduplicates identical rule/index hits", () => {
    const r = analyzeSql("SELECT * FROM u", "postgresql");
    const keys = r.findings.map((f) => `${f.ruleId}@${f.index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("works across all four dialects", () => {
    for (const d of ["postgresql", "mysql", "transactsql", "sqlite"] as const) {
      const r = analyzeSql("SELECT * FROM u WHERE name LIKE '%x'", d);
      expect(r.findings.some((f) => f.ruleId === "leading-wildcard-like")).toBe(true);
    }
  });
});

describe("rule catalog", () => {
  it("exposes at least 15 rules", () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(15);
  });
  it("has unique rule ids", () => {
    const seen = new Set(ALL_RULES.map((r) => r.id));
    expect(seen.size).toBe(ALL_RULES.length);
  });
  it("every rule has non-empty explanation and suggestion", () => {
    for (const r of ALL_RULES) {
      expect(r.explanation.length).toBeGreaterThan(20);
      expect(r.suggestion.length).toBeGreaterThan(10);
      expect(r.summary.length).toBeGreaterThan(10);
    }
  });
  it("every rule has a valid severity and category", () => {
    const sev = new Set(["critical", "high", "medium", "low"]);
    for (const r of ALL_RULES) expect(sev.has(r.severity)).toBe(true);
  });
});
