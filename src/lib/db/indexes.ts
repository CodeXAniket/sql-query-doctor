import type { QueryExecutor } from "./types";

export interface SuggestedIndex {
  name: string;
  table: string;
  ddl: string;
  rationale: string;
}

/**
 * The indexes the benchmark adds. Each targets columns the 30 benchmark queries
 * filter, join or sort on — turning sequential scans into index scans.
 */
export const SUGGESTED_INDEXES: SuggestedIndex[] = [
  {
    name: "idx_orders_user_id",
    table: "orders",
    ddl: "CREATE INDEX idx_orders_user_id ON orders (user_id);",
    rationale: "Point lookups and joins on orders.user_id (the most common access path).",
  },
  {
    name: "idx_orders_status",
    table: "orders",
    ddl: "CREATE INDEX idx_orders_status ON orders (status);",
    rationale: "Status filters (e.g. WHERE status = 'paid') stop scanning the whole table.",
  },
  {
    name: "idx_orders_created_at",
    table: "orders",
    ddl: "CREATE INDEX idx_orders_created_at ON orders (created_at);",
    rationale: "Date-range predicates and ORDER BY created_at become index range scans.",
  },
  {
    name: "idx_orders_user_status",
    table: "orders",
    ddl: "CREATE INDEX idx_orders_user_status ON orders (user_id, status);",
    rationale: "Composite index covering combined user + status filters in one scan.",
  },
  {
    name: "idx_orders_product_id",
    table: "orders",
    ddl: "CREATE INDEX idx_orders_product_id ON orders (product_id);",
    rationale: "Joins from orders to products resolve via an index instead of a hash of the table.",
  },
  {
    name: "idx_users_country",
    table: "users",
    ddl: "CREATE INDEX idx_users_country ON users (country);",
    rationale: "Grouping and filtering users by country avoids a full users scan.",
  },
  {
    name: "idx_users_email",
    table: "users",
    ddl: "CREATE UNIQUE INDEX idx_users_email ON users (email);",
    rationale: "Unique email lookups become single-row index seeks.",
  },
  {
    name: "idx_products_category",
    table: "products",
    ddl: "CREATE INDEX idx_products_category ON products (category);",
    rationale: "Category filters on products use an index range scan.",
  },
];

export const DROP_INDEXES_SQL = SUGGESTED_INDEXES.map(
  (i) => `DROP INDEX IF EXISTS ${i.name};`,
).join("\n");

/** Create every suggested index, then refresh planner statistics. */
export async function createSuggestedIndexes(db: QueryExecutor): Promise<void> {
  for (const idx of SUGGESTED_INDEXES) {
    await db.exec(idx.ddl);
  }
  await db.exec("ANALYZE;");
}

/** Drop every suggested index (to reset the "before" state). */
export async function dropSuggestedIndexes(db: QueryExecutor): Promise<void> {
  await db.exec(DROP_INDEXES_SQL);
  await db.exec("ANALYZE;");
}
