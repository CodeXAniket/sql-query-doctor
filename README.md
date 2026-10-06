# SQL Query Doctor

A web-based SQL **performance clinic**. Paste a query and get instant, explained feedback on
performance anti-patterns — then spin up a **real PostgreSQL in your browser** (WebAssembly), seed a
~500K-row dataset, and benchmark the measured speed-up that indexes deliver.

Built with React, TypeScript, PGlite (WASM Postgres), and CodeMirror. Design language pairs a
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

### 2 · Benchmark — in-browser Postgres, measured index speed-ups
- **PGlite** compiles PostgreSQL to WebAssembly and runs it entirely in the tab — nothing is sent
  to a server.
- One click seeds a **~500K-row** e-commerce dataset (`users`, `products`, `orders`) using
  `generate_series`.
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
| Editor | CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-sql`) |
| Fonts | Anton, Space Grotesk, JetBrains Mono (self-hosted via Fontsource) |
| Tests | Vitest + Testing Library (**120 tests**, incl. real PGlite integration) |

---

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm test           # run the full test suite (120 tests)
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
    db/                    # PGlite client, schema/seed, suggested indexes
    benchmark/             # 30 queries + before/after runner (pure stats)
  features/                # React views
    analyzer/  benchmark/
  components/              # brutalist UI primitives + Memphis decorations
  styles/                  # design tokens + component/feature CSS
```

The `lib/` layer has no React dependency and is where the tests live. The benchmark runner is
written against a small `QueryExecutor` interface so its orchestration is unit-tested with a mock,
while a separate integration test exercises real PGlite on a small dataset (seed SQL, every index,
and every benchmark query).

---

## Design

The visual system keeps a neo-brutalist frame — dark-teal borders and hard offset shadows,
ultra-bold condensed display type (Anton) paired with a clean grotesque (Space Grotesk) and a
monospace (JetBrains Mono) for code — over the **Solarized** palette: a warm base3 canvas, a
Solarized-blue brand strip, a cyan primary accent, and Solarized red/orange/yellow/blue for finding
severities. All colours are CSS custom properties defined in `src/styles/tokens.css`.
