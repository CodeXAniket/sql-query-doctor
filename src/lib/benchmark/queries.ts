export interface BenchmarkQuery {
  id: string;
  label: string;
  sql: string;
  /** Which access pattern this query exercises. */
  pattern: "point-lookup" | "filter" | "range" | "join" | "aggregate" | "sort";
}

/**
 * 30 read queries over the demo schema, spanning the access patterns the
 * suggested indexes target. Each is run before and after indexing so the
 * benchmark can report the median speed-up.
 */
export const BENCHMARK_QUERIES: BenchmarkQuery[] = [
  // ---- point lookups on orders.user_id -------------------------------------
  { id: "q01", label: "Orders for one user", pattern: "point-lookup", sql: "SELECT id, total, status FROM orders WHERE user_id = 12345;" },
  { id: "q02", label: "Order count for a user", pattern: "point-lookup", sql: "SELECT count(*) FROM orders WHERE user_id = 999;" },
  { id: "q03", label: "Latest order for a user", pattern: "point-lookup", sql: "SELECT id, created_at FROM orders WHERE user_id = 50 ORDER BY created_at DESC LIMIT 1;" },
  { id: "q04", label: "Spend by a single user", pattern: "point-lookup", sql: "SELECT sum(total) FROM orders WHERE user_id = 4242;" },

  // ---- status filters ------------------------------------------------------
  { id: "q05", label: "Cancelled orders", pattern: "filter", sql: "SELECT count(*) FROM orders WHERE status = 'cancelled';" },
  { id: "q06", label: "Paid order totals", pattern: "filter", sql: "SELECT sum(total) FROM orders WHERE status = 'paid';" },
  { id: "q07", label: "Pending orders sample", pattern: "filter", sql: "SELECT id, user_id FROM orders WHERE status = 'pending' LIMIT 100;" },
  { id: "q08", label: "Delivered order count", pattern: "filter", sql: "SELECT count(*) FROM orders WHERE status = 'delivered';" },

  // ---- combined user + status (composite index) ----------------------------
  { id: "q09", label: "A user's paid orders", pattern: "filter", sql: "SELECT id, total FROM orders WHERE user_id = 321 AND status = 'paid';" },
  { id: "q10", label: "A user's cancelled count", pattern: "filter", sql: "SELECT count(*) FROM orders WHERE user_id = 777 AND status = 'cancelled';" },

  // ---- product joins -------------------------------------------------------
  { id: "q11", label: "Orders of one product", pattern: "join", sql: "SELECT count(*) FROM orders WHERE product_id = 1500;" },
  { id: "q12", label: "Revenue by product (top)", pattern: "aggregate", sql: "SELECT product_id, sum(total) AS rev FROM orders GROUP BY product_id ORDER BY rev DESC LIMIT 10;" },
  { id: "q13", label: "Order + product join", pattern: "join", sql: "SELECT o.id, p.name FROM orders o JOIN products p ON p.id = o.product_id WHERE o.product_id = 42;" },

  // ---- date ranges ---------------------------------------------------------
  { id: "q14", label: "Orders in last 30 days", pattern: "range", sql: "SELECT count(*) FROM orders WHERE created_at > now() - interval '30 days';" },
  { id: "q15", label: "Recent orders page", pattern: "sort", sql: "SELECT id, total FROM orders ORDER BY created_at DESC LIMIT 20;" },
  { id: "q16", label: "Revenue last 7 days", pattern: "range", sql: "SELECT sum(total) FROM orders WHERE created_at > now() - interval '7 days';" },
  { id: "q17", label: "Oldest orders", pattern: "sort", sql: "SELECT id FROM orders ORDER BY created_at ASC LIMIT 20;" },

  // ---- user joins & filters ------------------------------------------------
  { id: "q18", label: "User by email", pattern: "point-lookup", sql: "SELECT id, name FROM users WHERE email = 'user12345@example.com';" },
  { id: "q19", label: "Active users by country", pattern: "aggregate", sql: "SELECT country, count(*) FROM users WHERE is_active GROUP BY country;" },
  { id: "q20", label: "Users in Germany", pattern: "filter", sql: "SELECT count(*) FROM users WHERE country = 'DE';" },
  { id: "q21", label: "Orders by a country's users", pattern: "join", sql: "SELECT count(*) FROM orders o JOIN users u ON u.id = o.user_id WHERE u.country = 'JP';" },
  { id: "q22", label: "Top spenders", pattern: "aggregate", sql: "SELECT user_id, sum(total) AS s FROM orders GROUP BY user_id ORDER BY s DESC LIMIT 10;" },

  // ---- category filters ----------------------------------------------------
  { id: "q23", label: "Products in a category", pattern: "filter", sql: "SELECT count(*) FROM products WHERE category = 'electronics';" },
  { id: "q24", label: "Revenue by category", pattern: "join", sql: "SELECT p.category, sum(o.total) AS rev FROM orders o JOIN products p ON p.id = o.product_id GROUP BY p.category ORDER BY rev DESC;" },

  // ---- mixed / heavier -----------------------------------------------------
  { id: "q25", label: "Paid orders for a user, dated", pattern: "range", sql: "SELECT id, created_at FROM orders WHERE user_id = 8080 AND status = 'paid' ORDER BY created_at DESC LIMIT 10;" },
  { id: "q26", label: "High-value recent orders", pattern: "range", sql: "SELECT id, total FROM orders WHERE created_at > now() - interval '90 days' AND total > 400 ORDER BY total DESC LIMIT 25;" },
  { id: "q27", label: "Distinct statuses for a user", pattern: "point-lookup", sql: "SELECT DISTINCT status FROM orders WHERE user_id = 606;" },
  { id: "q28", label: "Avg order value by status", pattern: "aggregate", sql: "SELECT status, avg(total) FROM orders GROUP BY status;" },
  { id: "q29", label: "User order history join", pattern: "join", sql: "SELECT u.name, count(o.id) FROM users u JOIN orders o ON o.user_id = u.id WHERE u.id = 15000 GROUP BY u.name;" },
  { id: "q30", label: "Recent paid revenue", pattern: "range", sql: "SELECT sum(total) FROM orders WHERE status = 'paid' AND created_at > now() - interval '14 days';" },
];
