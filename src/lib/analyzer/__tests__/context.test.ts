import { describe, it, expect } from "vitest";
import { maskSql, buildContext, positionAt, toRange } from "../context";

describe("maskSql", () => {
  it("blanks single-quoted string contents but preserves length", () => {
    const raw = "SELECT * FROM t WHERE name = 'WHERE'";
    const { masked } = maskSql(raw, "postgresql");
    expect(masked).toHaveLength(raw.length);
    // The WHERE inside the string must not survive as a keyword.
    expect(masked.toLowerCase().match(/where/g)).toHaveLength(1);
  });

  it("preserves newlines inside masked regions", () => {
    const raw = "SELECT 1 -- comment\nFROM t";
    const { masked } = maskSql(raw, "postgresql");
    expect(masked.split("\n")).toHaveLength(2);
    expect(masked.toLowerCase()).not.toContain("comment");
  });

  it("handles '' escaped quotes inside a string", () => {
    const raw = "SELECT 'it''s fine' AS x, id FROM t";
    const { masked } = maskSql(raw, "postgresql");
    expect(masked).toHaveLength(raw.length);
    expect(masked).toContain("AS x, id FROM t");
  });

  it("masks block comments", () => {
    const raw = "SELECT /* SELECT inside */ id FROM t";
    const { masked } = maskSql(raw, "postgresql");
    expect(masked.toLowerCase().match(/select/g)).toHaveLength(1);
  });

  it("masks line comments and MySQL # comments", () => {
    const pg = maskSql("SELECT 1 -- LIKE '%x'\nFROM t", "postgresql");
    expect(pg.masked.toLowerCase()).not.toContain("like");
    const my = maskSql("SELECT 1 # LIKE '%x'\nFROM t", "mysql");
    expect(my.masked.toLowerCase()).not.toContain("like");
  });

  it("does not treat # as a comment outside MySQL", () => {
    const { masked } = maskSql("SELECT 1 # not-a-comment", "postgresql");
    expect(masked).toContain("#");
  });

  it("masks double-quoted identifiers and backticks", () => {
    const dq = maskSql('SELECT "weird col" FROM t', "postgresql");
    expect(dq.codeMask[8]).toBe(false);
    const bt = maskSql("SELECT `weird col` FROM t", "mysql");
    expect(bt.codeMask[8]).toBe(false);
  });

  it("marks code characters as true in the mask array", () => {
    const raw = "SELECT id";
    const { codeMask } = maskSql(raw, "postgresql");
    expect(codeMask.every((b) => b === true)).toBe(true);
  });
});

describe("positionAt", () => {
  const text = "line1\nline2\nthird";
  it("returns line 1 column 1 for index 0", () => {
    expect(positionAt(text, 0)).toEqual({ line: 1, column: 1 });
  });
  it("computes column within the first line", () => {
    expect(positionAt(text, 3)).toEqual({ line: 1, column: 4 });
  });
  it("computes line 2 positions", () => {
    expect(positionAt(text, 6)).toEqual({ line: 2, column: 1 });
  });
  it("computes line 3 positions", () => {
    expect(positionAt(text, 12)).toEqual({ line: 3, column: 1 });
  });
});

describe("toRange", () => {
  it("expands index/length to a full range", () => {
    const text = "abc\ndef";
    const r = toRange(text, 4, 3);
    expect(r).toMatchObject({ index: 4, length: 3, line: 2, column: 1, endLine: 2, endColumn: 4 });
  });
});

describe("buildContext", () => {
  it("normalizes CRLF and parses valid SQL", () => {
    const ctx = buildContext("SELECT id\r\nFROM t", "postgresql");
    expect(ctx.raw).not.toContain("\r");
    expect(ctx.ast).not.toBeNull();
    expect(ctx.parseError).toBeUndefined();
  });

  it("captures a parse error without throwing on invalid SQL", () => {
    const ctx = buildContext("SELECT FROM WHERE", "postgresql");
    expect(ctx.ast).toBeNull();
    expect(typeof ctx.parseError).toBe("string");
  });

  it("exposes a lowercased masked string", () => {
    const ctx = buildContext("SELECT ID FROM T", "postgresql");
    expect(ctx.lower).toBe(ctx.masked.toLowerCase());
  });
});
