# SQL Query Doctor

A web-based SQL **anti-pattern analyzer**. Paste a query, pick a dialect, and get instant,
explained feedback on performance anti-patterns — each finding tells you *why it's slow* and *how to
fix it*.

Built with React, TypeScript, and CodeMirror; it runs 100% in the browser (no backend). The design
pairs a neo-brutalist frame (chunky borders, hard offset shadows, condensed display type) with the
**Solarized** palette.

---

## Features

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

---

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 18 + TypeScript, Vite |
| SQL parsing | `node-sql-parser` (multi-dialect) |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-sql`) |
| Fonts | Anton, Space Grotesk, JetBrains Mono (self-hosted via Fontsource) |
| Tests | Vitest + Testing Library (**94 tests**) |

---

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm test           # run the full test suite (94 tests)
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
  features/analyzer/       # React view (editor + findings + rule catalog)
  components/              # brutalist UI primitives + Memphis decorations
  styles/                  # design tokens + component/feature CSS
```

The `lib/` layer has no React dependency and is where the tests live — the rules engine can run in a
browser, a CLI, or a CI hook unchanged.

---

## Design

The visual system keeps a neo-brutalist frame — dark-teal borders and hard offset shadows,
ultra-bold condensed display type (Anton) paired with a clean grotesque (Space Grotesk) and a
monospace (JetBrains Mono) for code — over the **Solarized** palette: a warm base3 canvas, a
Solarized-blue brand strip, a cyan primary accent, and Solarized red/orange/yellow/blue for finding
severities. All colours are CSS custom properties defined in `src/styles/tokens.css`.
