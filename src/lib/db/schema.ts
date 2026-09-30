import type { QueryExecutor, SeedProgress } from "./types";

export type DatasetSizes = { users: number; products: number; orders: number };

/** Dataset sizing. `orders` is the headline ~500K-row table. */
export const DATASET: DatasetSizes = {
  users: 50_000,
  products: 2_000,
  orders: 500_000,
};

export const TOTAL_ROWS = DATASET.users + DATASET.products + DATASET.orders;

/** DDL for the demo schema — intentionally free of secondary indexes so the
 *  benchmark can add them and measure the difference. */
export const SCHEMA_DDL = `
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL,
  country     text NOT NULL,
  is_active   boolean NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE TABLE products (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  price       numeric(10,2) NOT NULL,
  created_at  timestamptz NOT NULL
);

CREATE TABLE orders (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL,
  product_id  integer NOT NULL,
  status      text NOT NULL,
  total       numeric(10,2) NOT NULL,
  created_at  timestamptz NOT NULL
);
`;

const COUNTRIES = ["US", "GB", "DE", "FR", "IN", "BR", "JP", "CA"];
const CATEGORIES = ["electronics", "books", "home", "toys", "grocery", "apparel"];
const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

const pgArray = (xs: string[]) => `ARRAY[${xs.map((x) => `'${x}'`).join(",")}]`;

/** Build the INSERT ... SELECT generate_series statement for each table. */
export function seedSql(table: keyof typeof DATASET, count: number): string {
  switch (table) {
    case "users":
      return `
INSERT INTO users (name, email, country, is_active, created_at)
SELECT 'User ' || g,
       'user' || g || '@example.com',
       (${pgArray(COUNTRIES)})[1 + floor(random() * ${COUNTRIES.length})::int],
       random() < 0.9,
       now() - (random() * 1095 || ' days')::interval
FROM generate_series(1, ${count}) g;`;
    case "products":
      return `
INSERT INTO products (name, category, price, created_at)
SELECT 'Product ' || g,
       (${pgArray(CATEGORIES)})[1 + floor(random() * ${CATEGORIES.length})::int],
       round((random() * 500 + 1)::numeric, 2),
       now() - (random() * 730 || ' days')::interval
FROM generate_series(1, ${count}) g;`;
    case "orders":
      return `
INSERT INTO orders (user_id, product_id, status, total, created_at)
SELECT 1 + floor(random() * ${DATASET.users})::int,
       1 + floor(random() * ${DATASET.products})::int,
       (${pgArray(STATUSES)})[1 + floor(random() * ${STATUSES.length})::int],
       round((random() * 500 + 1)::numeric, 2),
       now() - (random() * 365 || ' days')::interval
FROM generate_series(1, ${count}) g;`;
  }
}

/**
 * Seed the whole dataset. Large tables are inserted in batches so the UI can
 * report progress and the WASM heap stays bounded.
 */
export async function seedDatabase(
  db: QueryExecutor,
  onProgress?: SeedProgress,
  sizes: Partial<DatasetSizes> = {},
): Promise<void> {
  const cfg = { ...DATASET, ...sizes };
  await db.exec(SCHEMA_DDL);

  const tables: (keyof typeof DATASET)[] = ["users", "products", "orders"];
  for (const table of tables) {
    const total = cfg[table];
    const batch = 50_000;
    let done = 0;
    while (done < total) {
      const n = Math.min(batch, total - done);
      await db.exec(seedSql(table, n));
      done += n;
      onProgress?.({ phase: `Seeding ${table}`, done, total });
    }
  }
  await db.exec("ANALYZE;");
  onProgress?.({ phase: "Done", done: 1, total: 1 });
}
