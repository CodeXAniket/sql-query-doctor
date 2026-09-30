# SQL Query Doctor

A web-based SQL **performance clinic**. Paste a query and get instant, explained feedback on
performance anti-patterns; paste an `EXPLAIN` from any of four database engines and see it as one
unified, cost-heat-coloured tree; or spin up a **real PostgreSQL in your browser** (WebAssembly),
seed a ~500K-row dataset, and benchmark the measured impact of indexes.

Built with React, TypeScript, PGlite (WASM Postgres), D3, and CodeMirror. Design language pairs a
neo-brutalist frame (chunky borders, hard offset shadows, condensed display type) with the
**Solarized** palette — a warm base3 canvas, a blue brand strip, and a cyan primary accent.

---

## Features

### 1 · Analyzer — multi-dialect anti-pattern linter
- Parses SQL in **4 dialects** (PostgreSQL, MySQL, SQL Server / T-SQL, SQLite) via
  `node-sql-parser`, with a resilient text-scanning fallback so linting still runs on
  unparseable-but-lintable SQL.
- **19 performance anti-pattern rules**, each with a severity, the reason it's slow, and how to
  fix it. Examples: leading-wildcard `LIKE`, non-sargable functions on indexed columns, implicit
  type conversions, `NOT IN (subquery)`, correlated subqueries in the `SELECT` list, comma /
  cross joins, `ORDER BY random()`, large-`OFFSET` pagination, `UNION` vs `UNION ALL`, and
  `UPDATE`/`DELETE` without a `WHERE`.
- String- and comment-aware scanning: keyword matches never fire inside string literals or
  comments (a length-preserving mask keeps source positions exact).
- Live analysis as you type, with a CodeMirror editor themed to match, severity filters, and a
  full rule catalog.

### 2 · Plan Tree — unified execution-plan visualizer
- Ingests native `EXPLAIN` output from **4 engines** and normalizes it into **one plan model**:
  - PostgreSQL — `EXPLAIN (FORMAT JSON)` *and* the default text format
  - MySQL — `EXPLAIN FORMAT=JSON`
  - SQL Server — Showplan / `STATISTICS XML`
  - SQLite — `EXPLAIN QUERY PLAN` (pretty-tree and tabular forms)
- Renders the normalized plan as a **D3 tree**, heat-coloured by each node's self cost, with the
  bottleneck flagged **HOT** and any node whose **row estimate is off by more than 10×** outlined
  and badged. Click any node for full detail (estimated vs actual rows, cost share, timing).

### 3 · Playground — in-browser Postgres + index benchmark
- **PGlite** compiles PostgreSQL to WebAssembly and runs it entirely in the tab — nothing is sent
  to a server.
- One click seeds a **~500K-row** e-commerce dataset (`users`, `products`, `orders`) using
  `generate_series`.
- Run arbitrary SQL with a results grid and timing; run **`EXPLAIN ANALYZE`** and pipe the live
  plan straight into the Plan Tree renderer.
- The **30-query benchmark** runs every query with no secondary indexes, adds the suggested
  indexes, and re-runs them — reporting the *measured, live* median speed-up (point-lookups
  typically improve 50–100×+).

---

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 18 + TypeScript, Vite |
| SQL parsing | `node-sql-parser` (multi-dialect) |
| In-browser DB | `@electric-sql/pglite` (PostgreSQL → WASM) |
| Plan tree | `d3-hierarchy`, `d3-shape`, `d3-scale`, `d3-scale-chromatic` |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-sql`) |
| XML plans | `fast-xml-parser` |
| Fonts | Anton, Space Grotesk, JetBrains Mono (self-hosted via Fontsource) |
| Tests | Vitest + Testing Library (**167 tests**, incl. real PGlite integration) |

---

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm test           # run the full test suite (167 tests)
npm run test:watch # watch mode
npm run coverage   # coverage report for the lib layer
npm run build      # type-check + production build
npm run preview    # preview the production build
```

---

## Architecture

```
src/
  lib/                     # framework-agnostic, fully unit-tested core
    analyzer/              # anti-pattern engine
      context.ts           #   string/comment masking + source positions
      scan.ts              #   WHERE/ON-aware scanning helpers
      rules/               #   19 rules grouped by category
      analyze.ts           #   runner → sorted, de-duplicated findings
    parser/                # node-sql-parser wrapper (4 dialects)
    plan/                  # unified execution-plan model
      parsers/             #   postgres | mysql | sqlserver | sqlite
      metrics.ts           #   self cost, row-estimate error, summaries
    db/                    # PGlite client, schema/seed, suggested indexes
    benchmark/             # 30 queries + before/after runner (pure stats)
  features/                # React views
    analyzer/  plan/  playground/
  components/              # brutalist UI primitives + Memphis decorations
  styles/                  # design tokens + component/feature CSS
```

The `lib/` layer has no React dependency and is where the tests live. The benchmark runner is
written against a small `QueryExecutor` interface so its orchestration is unit-tested with a mock,
while a separate integration test exercises real PGlite on a small dataset (seed SQL, every index,
every benchmark query, and the `EXPLAIN` → plan-model pipeline).

---

## Design

The visual system keeps a neo-brutalist frame — dark-teal borders and hard offset shadows,
ultra-bold condensed display type (Anton) paired with a clean grotesque (Space Grotesk) and a
monospace (JetBrains Mono) for code — over the **Solarized** palette: a warm base3 canvas, a
Solarized-blue brand strip, a cyan primary accent, and Solarized red/orange/yellow/blue for finding
severities. All colours are CSS custom properties defined in `src/styles/tokens.css`.
