import { describe, it, expect } from "vitest";
import { analyzeSql } from "../analyze";
import type { Dialect } from "../types";

/** Return the set of rule ids that fired for a SQL string. */
function ids(sql: string, dialect: Dialect = "postgresql"): string[] {
  return analyzeSql(sql, dialect).findings.map((f) => f.ruleId);
}
/** Does a specific rule fire? */
function fires(rule: string, sql: string, dialect: Dialect = "postgresql"): boolean {
  return ids(sql, dialect).includes(rule);
}

describe("leading-wildcard-like", () => {
  it("flags a leading % wildcard", () => {
    expect(fires("leading-wildcard-like", "SELECT id FROM u WHERE name LIKE '%smith'")).toBe(true);
  });
  it("flags a leading _ wildcard", () => {
    expect(fires("leading-wildcard-like", "SELECT id FROM u WHERE name LIKE '_mith'")).toBe(true);
  });
  it("flags ILIKE and NOT LIKE too", () => {
    expect(fires("leading-wildcard-like", "SELECT id FROM u WHERE name ILIKE '%x'")).toBe(true);
    expect(fires("leading-wildcard-like", "SELECT id FROM u WHERE name NOT LIKE '%x'")).toBe(true);
  });
  it("does not flag a trailing-only wildcard", () => {
    expect(fires("leading-wildcard-like", "SELECT id FROM u WHERE name LIKE 'smith%'")).toBe(false);
  });
  it("ignores LIKE inside a comment", () => {
    expect(fires("leading-wildcard-like", "SELECT id FROM u -- name LIKE '%x'\nWHERE id = 1")).toBe(
      false,
    );
  });
});

describe("non-sargable-function", () => {
  it("flags UPPER(col) = ...", () => {
    expect(fires("non-sargable-function", "SELECT id FROM u WHERE UPPER(name) = 'X'")).toBe(true);
  });
  it("flags DATE(col) comparison", () => {
    expect(fires("non-sargable-function", "SELECT id FROM u WHERE DATE(created) >= '2024-01-01'")).toBe(
      true,
    );
  });
  it("flags YEAR(col) = literal", () => {
    expect(fires("non-sargable-function", "SELECT id FROM u WHERE YEAR(created) = 2024")).toBe(true);
  });
  it("does not flag a function in the SELECT list", () => {
    expect(fires("non-sargable-function", "SELECT UPPER(name) FROM u WHERE id = 1")).toBe(false);
  });
  it("does not flag aggregates like SUM in HAVING", () => {
    expect(
      fires("non-sargable-function", "SELECT c FROM u GROUP BY c HAVING SUM(x) > 5"),
    ).toBe(false);
  });
});

describe("implicit-conversion", () => {
  it("flags numeric column = quoted number", () => {
    expect(fires("implicit-conversion", "SELECT id FROM u WHERE user_id = '42'")).toBe(true);
  });
  it("does not flag a proper numeric comparison", () => {
    expect(fires("implicit-conversion", "SELECT id FROM u WHERE user_id = 42")).toBe(false);
  });
  it("does not flag a genuine string comparison", () => {
    expect(fires("implicit-conversion", "SELECT id FROM u WHERE name = 'joe'")).toBe(false);
  });
});

describe("or-in-where", () => {
  it("flags OR in the WHERE clause", () => {
    expect(fires("or-in-where", "SELECT id FROM u WHERE a = 1 OR b = 2")).toBe(true);
  });
  it("does not flag OR that only appears in a string", () => {
    expect(fires("or-in-where", "SELECT id FROM u WHERE name = 'a or b'")).toBe(false);
  });
  it("does not fire without a WHERE", () => {
    expect(fires("or-in-where", "SELECT id FROM u")).toBe(false);
  });
});

describe("inequality-operator", () => {
  it("flags != in WHERE", () => {
    expect(fires("inequality-operator", "SELECT id FROM u WHERE status != 'x'")).toBe(true);
  });
  it("flags <> in WHERE", () => {
    expect(fires("inequality-operator", "SELECT id FROM u WHERE status <> 1")).toBe(true);
  });
  it("does not fire on plain equality", () => {
    expect(fires("inequality-operator", "SELECT id FROM u WHERE status = 1")).toBe(false);
  });
});

describe("like-no-wildcard", () => {
  it("flags LIKE with no wildcard", () => {
    expect(fires("like-no-wildcard", "SELECT id FROM u WHERE name LIKE 'joe'")).toBe(true);
  });
  it("does not flag LIKE with a wildcard", () => {
    expect(fires("like-no-wildcard", "SELECT id FROM u WHERE name LIKE 'joe%'")).toBe(false);
  });
});

describe("having-without-aggregate", () => {
  it("flags HAVING on a plain column", () => {
    expect(fires("having-without-aggregate", "SELECT c FROM u GROUP BY c HAVING c > 5")).toBe(true);
  });
  it("does not flag HAVING with an aggregate", () => {
    expect(
      fires("having-without-aggregate", "SELECT c FROM u GROUP BY c HAVING COUNT(*) > 5"),
    ).toBe(false);
  });
});

describe("not-in-subquery", () => {
  it("flags NOT IN (SELECT ...)", () => {
    expect(
      fires("not-in-subquery", "SELECT id FROM u WHERE id NOT IN (SELECT uid FROM banned)"),
    ).toBe(true);
  });
  it("does not flag NOT IN with a value list", () => {
    expect(fires("not-in-subquery", "SELECT id FROM u WHERE id NOT IN (1, 2, 3)")).toBe(false);
  });
});

describe("in-subquery", () => {
  it("flags IN (SELECT ...)", () => {
    expect(fires("in-subquery", "SELECT id FROM u WHERE id IN (SELECT uid FROM vip)")).toBe(true);
  });
  it("does not flag NOT IN (SELECT ...) as a plain IN", () => {
    const fired = ids("SELECT id FROM u WHERE id NOT IN (SELECT uid FROM vip)");
    expect(fired).toContain("not-in-subquery");
    expect(fired).not.toContain("in-subquery");
  });
  it("does not flag IN with a value list", () => {
    expect(fires("in-subquery", "SELECT id FROM u WHERE id IN (1,2,3)")).toBe(false);
  });
});

describe("scalar-subquery-in-select", () => {
  it("flags a subquery in the SELECT list", () => {
    expect(
      fires(
        "scalar-subquery-in-select",
        "SELECT id, (SELECT COUNT(*) FROM o WHERE o.uid = u.id) AS n FROM u",
      ),
    ).toBe(true);
  });
  it("does not flag a subquery only in WHERE", () => {
    expect(
      fires("scalar-subquery-in-select", "SELECT id FROM u WHERE id IN (SELECT uid FROM o)"),
    ).toBe(false);
  });
});

describe("implicit-cross-join", () => {
  it("flags comma-separated tables in FROM", () => {
    expect(fires("implicit-cross-join", "SELECT * FROM a, b WHERE a.id = b.a_id")).toBe(true);
  });
  it("flags explicit CROSS JOIN", () => {
    expect(fires("implicit-cross-join", "SELECT * FROM a CROSS JOIN b")).toBe(true);
  });
  it("does not flag an explicit inner join", () => {
    expect(fires("implicit-cross-join", "SELECT * FROM a JOIN b ON a.id = b.a_id")).toBe(false);
  });
});

describe("select-star", () => {
  it("flags SELECT *", () => {
    expect(fires("select-star", "SELECT * FROM u")).toBe(true);
  });
  it("flags qualified t.*", () => {
    expect(fires("select-star", "SELECT u.* FROM u")).toBe(true);
  });
  it("does not flag COUNT(*)", () => {
    expect(fires("select-star", "SELECT COUNT(*) FROM u")).toBe(false);
  });
  it("does not flag an explicit column list", () => {
    expect(fires("select-star", "SELECT id, name FROM u")).toBe(false);
  });
});

describe("select-distinct", () => {
  it("flags SELECT DISTINCT", () => {
    expect(fires("select-distinct", "SELECT DISTINCT name FROM u")).toBe(true);
  });
  it("does not flag a plain SELECT", () => {
    expect(fires("select-distinct", "SELECT name FROM u")).toBe(false);
  });
});

describe("order-by-random", () => {
  it("flags ORDER BY random() (Postgres)", () => {
    expect(fires("order-by-random", "SELECT id FROM u ORDER BY random() LIMIT 1")).toBe(true);
  });
  it("flags ORDER BY RAND() (MySQL)", () => {
    expect(fires("order-by-random", "SELECT id FROM u ORDER BY RAND() LIMIT 1", "mysql")).toBe(true);
  });
  it("does not flag ordering by a column", () => {
    expect(fires("order-by-random", "SELECT id FROM u ORDER BY created LIMIT 1")).toBe(false);
  });
});

describe("limit-without-order-by", () => {
  it("flags LIMIT with no ORDER BY", () => {
    expect(fires("limit-without-order-by", "SELECT id FROM u LIMIT 10")).toBe(true);
  });
  it("does not flag LIMIT with ORDER BY", () => {
    expect(fires("limit-without-order-by", "SELECT id FROM u ORDER BY id LIMIT 10")).toBe(false);
  });
});

describe("large-offset-pagination", () => {
  it("flags a large OFFSET", () => {
    expect(
      fires("large-offset-pagination", "SELECT id FROM u ORDER BY id LIMIT 20 OFFSET 100000"),
    ).toBe(true);
  });
  it("does not flag a small OFFSET", () => {
    expect(
      fires("large-offset-pagination", "SELECT id FROM u ORDER BY id LIMIT 20 OFFSET 40"),
    ).toBe(false);
  });
});

describe("union-instead-of-union-all", () => {
  it("flags a bare UNION", () => {
    expect(fires("union-instead-of-union-all", "SELECT a FROM x UNION SELECT a FROM y")).toBe(true);
  });
  it("does not flag UNION ALL", () => {
    expect(
      fires("union-instead-of-union-all", "SELECT a FROM x UNION ALL SELECT a FROM y"),
    ).toBe(false);
  });
});

describe("missing-where-dml", () => {
  it("flags DELETE without WHERE", () => {
    expect(fires("missing-where-dml", "DELETE FROM u")).toBe(true);
  });
  it("flags UPDATE without WHERE", () => {
    expect(fires("missing-where-dml", "UPDATE u SET active = false")).toBe(true);
  });
  it("does not flag DELETE with WHERE", () => {
    expect(fires("missing-where-dml", "DELETE FROM u WHERE id = 1")).toBe(false);
  });
  it("does not flag UPDATE with WHERE", () => {
    expect(fires("missing-where-dml", "UPDATE u SET active = false WHERE id = 1")).toBe(false);
  });
  it("is marked critical", () => {
    const f = analyzeSql("DELETE FROM u", "postgresql").findings.find(
      (x) => x.ruleId === "missing-where-dml",
    );
    expect(f?.severity).toBe("critical");
  });
});

describe("equals-null", () => {
  it("flags = NULL", () => {
    expect(fires("equals-null", "SELECT id FROM u WHERE deleted = NULL")).toBe(true);
  });
  it("flags <> NULL", () => {
    expect(fires("equals-null", "SELECT id FROM u WHERE deleted <> NULL")).toBe(true);
  });
  it("does not flag IS NULL", () => {
    expect(fires("equals-null", "SELECT id FROM u WHERE deleted IS NULL")).toBe(false);
  });
});
