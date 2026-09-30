import { describe, it, expect } from "vitest";
import { parseSql, isValidSql } from "../parse";
import type { Dialect } from "../../analyzer/types";

const DIALECTS: Dialect[] = ["postgresql", "mysql", "transactsql", "sqlite"];

describe("parseSql", () => {
  it("parses a simple SELECT in every dialect", () => {
    for (const d of DIALECTS) {
      const r = parseSql("SELECT id FROM users", d);
      expect(r.error).toBeUndefined();
      expect(Array.isArray(r.ast)).toBe(true);
    }
  });

  it("returns null AST for empty input", () => {
    expect(parseSql("   ", "postgresql").ast).toBeNull();
  });

  it("captures an error for malformed SQL without throwing", () => {
    const r = parseSql("SELECT FROM WHERE", "postgresql");
    expect(r.ast).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it("always returns an array AST for valid single statements", () => {
    const r = parseSql("SELECT 1", "postgresql");
    expect(Array.isArray(r.ast)).toBe(true);
    expect(r.ast).toHaveLength(1);
  });

  it("parses multiple statements", () => {
    const r = parseSql("SELECT 1; SELECT 2;", "postgresql");
    expect(r.error).toBeUndefined();
    expect((r.ast ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("isValidSql", () => {
  it("is true for valid SQL", () => {
    expect(isValidSql("SELECT id FROM t", "postgresql")).toBe(true);
  });
  it("is false for invalid SQL", () => {
    expect(isValidSql("SELECT FROM", "postgresql")).toBe(false);
  });
  it("is false for empty input", () => {
    expect(isValidSql("", "postgresql")).toBe(false);
  });
});
