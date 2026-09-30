import type { Dialect } from "../../lib/analyzer/types";

export interface Example {
  label: string;
  dialect: Dialect;
  sql: string;
}

export const ANALYZER_EXAMPLES: Example[] = [
  {
    label: "The everything-wrong query",
    dialect: "postgresql",
    sql: `-- A dashboard query with a bit of everything
SELECT *
FROM orders o, users u
WHERE u.name LIKE '%smith'
  AND o.user_id = '42'
  AND DATE(o.created_at) = '2024-01-01'
  OR o.status != 'paid'
ORDER BY random()
LIMIT 20 OFFSET 100000;`,
  },
  {
    label: "N+1 in disguise",
    dialect: "postgresql",
    sql: `SELECT
  u.id,
  u.name,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
  (SELECT MAX(total) FROM orders o WHERE o.user_id = u.id) AS biggest
FROM users u
WHERE u.country = 'DE';`,
  },
  {
    label: "Anti-join trap (NULL-unsafe)",
    dialect: "mysql",
    sql: `SELECT id, email
FROM users
WHERE id NOT IN (
  SELECT user_id FROM orders WHERE status = 'cancelled'
);`,
  },
  {
    label: "Dangerous DML",
    dialect: "transactsql",
    sql: `-- Careful: this runs against the whole table
UPDATE users SET is_active = 0;

DELETE FROM orders;`,
  },
  {
    label: "Clean query (no findings)",
    dialect: "postgresql",
    sql: `SELECT o.id, o.total, u.name
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'paid'
  AND o.created_at >= '2024-01-01'
ORDER BY o.created_at DESC
LIMIT 50;`,
  },
];
