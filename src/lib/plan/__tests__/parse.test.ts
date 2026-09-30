import { describe, it, expect } from "vitest";
import { parsePlan, detectEngine } from "../parse";
import { parsePostgres } from "../parsers/postgres";
import { PLAN_SAMPLES } from "../samples";
import { flatten } from "../metrics";
import { PlanParseError } from "../types";

describe("PostgreSQL plan parsing", () => {
  const plan = parsePlan(PLAN_SAMPLES.postgresql, "postgresql");

  it("builds a tree from EXPLAIN JSON", () => {
    expect(plan.root.operation).toBe("Aggregate");
    expect(plan.root.children).toHaveLength(1);
  });
  it("normalizes join type into the operation name", () => {
    expect(plan.root.children[0].operation).toBe("Inner Hash Join");
  });
  it("captures relation names on scans", () => {
    const scans = flatten(plan.root).filter((n) => n.operation === "Seq Scan");
    expect(scans.map((s) => s.relation).sort()).toEqual(["orders", "users"]);
  });
  it("records estimated and actual rows", () => {
    const join = plan.root.children[0];
    expect(join.estimatedRows).toBe(500);
    expect(join.actualRows).toBe(8200);
  });
  it("flags actual data as present", () => {
    expect(plan.hasActual).toBe(true);
  });
  it("sets total cost from the root", () => {
    expect(plan.totalCost).toBe(24500.5);
  });
  it("computes self costs (subtree minus children)", () => {
    const orders = flatten(plan.root).find((n) => n.relation === "orders")!;
    expect(orders.selfCost).toBeCloseTo(18000, 0);
  });

  it("parses a text-format plan", () => {
    const text = `Aggregate  (cost=0.00..24500.50 rows=1 width=8) (actual time=0.0..210.5 rows=1 loops=1)
  ->  Hash Join  (cost=0.00..24000.00 rows=500 width=8) (actual time=0.0..205.0 rows=8200 loops=1)
        Hash Cond: (o.user_id = u.id)
        ->  Seq Scan on orders o  (cost=0.00..18000.00 rows=500000 width=8) (actual time=0.0..120.0 rows=500000 loops=1)
        ->  Seq Scan on users u  (cost=0.00..3000.00 rows=100000 width=8) (actual time=0.0..20.0 rows=100000 loops=1)`;
    const p = parsePostgres(text);
    expect(p.root.operation).toBe("Aggregate");
    expect(flatten(p.root)).toHaveLength(4);
    const orders = flatten(p.root).find((n) => n.relation === "orders");
    expect(orders?.estimatedRows).toBe(500000);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePlan("{not json", "postgresql")).toThrow(PlanParseError);
  });

  it("unwraps the PGlite 'QUERY PLAN' row shape", () => {
    const wrapped = JSON.stringify([{ "QUERY PLAN": JSON.parse(PLAN_SAMPLES.postgresql) }]);
    const p = parsePlan(wrapped, "postgresql");
    expect(p.root.operation).toBe("Aggregate");
  });
});

describe("MySQL plan parsing", () => {
  const plan = parsePlan(PLAN_SAMPLES.mysql, "mysql");

  it("wraps the query block and ordering operation", () => {
    expect(plan.root.operation).toContain("Query Block");
    expect(flatten(plan.root).some((n) => n.operation === "Sort (filesort)")).toBe(true);
  });
  it("maps access_type ALL to a full table scan", () => {
    const orders = flatten(plan.root).find((n) => n.relation === "orders");
    expect(orders?.operation).toBe("Full Table Scan");
  });
  it("maps eq_ref to a unique index lookup", () => {
    const users = flatten(plan.root).find((n) => n.relation === "users");
    expect(users?.operation).toBe("Unique Index Lookup");
  });
  it("uses query_cost as total cost", () => {
    expect(plan.totalCost).toBe(12500);
  });
  it("has no actual data (FORMAT=JSON is estimates only)", () => {
    expect(plan.hasActual).toBe(false);
  });
  it("throws when query_block is missing", () => {
    expect(() => parsePlan("{}", "mysql")).toThrow(PlanParseError);
  });
});

describe("SQL Server plan parsing", () => {
  const plan = parsePlan(PLAN_SAMPLES.sqlserver, "sqlserver");

  it("finds the root RelOp", () => {
    expect(plan.root.operation).toBe("Hash Match");
  });
  it("builds the RelOp child tree", () => {
    expect(plan.root.children).toHaveLength(2);
  });
  it("reads estimate rows and subtree cost", () => {
    expect(plan.root.estimatedRows).toBe(500);
    expect(plan.totalCost).toBe(24.5);
  });
  it("extracts table/index detail", () => {
    const scan = flatten(plan.root).find((n) => n.operation === "Table Scan");
    expect(scan?.detail).toContain("orders");
  });
  it("reads actual rows from RunTimeInformation", () => {
    const scan = flatten(plan.root).find((n) => n.operation === "Table Scan");
    expect(scan?.actualRows).toBe(500000);
    expect(plan.hasActual).toBe(true);
  });
  it("throws when no RelOp is present", () => {
    expect(() => parsePlan("<root></root>", "sqlserver")).toThrow(PlanParseError);
  });
});

describe("SQLite plan parsing", () => {
  const plan = parsePlan(PLAN_SAMPLES.sqlite, "sqlite");

  it("parses the pretty tree form", () => {
    const ops = flatten(plan.root).map((n) => n.operation);
    expect(ops).toContain("Scan");
    expect(ops).toContain("Use Temp B-Tree");
  });
  it("extracts the scanned relation", () => {
    expect(flatten(plan.root).some((n) => n.relation === "orders")).toBe(true);
  });
  it("has no cost data", () => {
    expect(plan.totalCost).toBeUndefined();
    expect(plan.hasActual).toBe(false);
  });
  it("parses the tabular form", () => {
    const tabular = `id|parent|notused|detail
3|0|0|SCAN TABLE orders
5|0|0|SEARCH TABLE users USING INTEGER PRIMARY KEY (rowid=?)`;
    const p = parsePlan(tabular, "sqlite");
    expect(flatten(p.root).some((n) => n.relation === "orders")).toBe(true);
    expect(flatten(p.root).some((n) => n.relation === "users")).toBe(true);
  });
  it("throws on empty input", () => {
    expect(() => parsePlan("   ", "sqlite")).toThrow(PlanParseError);
  });
});

describe("detectEngine", () => {
  it("detects SQL Server from XML", () => {
    expect(detectEngine(PLAN_SAMPLES.sqlserver)).toBe("sqlserver");
  });
  it("detects MySQL from query_block JSON", () => {
    expect(detectEngine(PLAN_SAMPLES.mysql)).toBe("mysql");
  });
  it("detects PostgreSQL from Node Type JSON", () => {
    expect(detectEngine(PLAN_SAMPLES.postgresql)).toBe("postgresql");
  });
  it("detects SQLite from tree markers", () => {
    expect(detectEngine(PLAN_SAMPLES.sqlite)).toBe("sqlite");
  });
  it("detects PostgreSQL text plans by the cost signature", () => {
    expect(detectEngine("Seq Scan on t  (cost=0.00..10.00 rows=5 width=4)")).toBe("postgresql");
  });
});
