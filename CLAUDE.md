# CLAUDE.md

Guidance for working in this repository.

## What this is
SQL Query Doctor — a React + TypeScript web app with three tools: a multi-dialect SQL
anti-pattern **analyzer**, a unified **execution-plan** (EXPLAIN) visualizer, and an in-browser
**PostgreSQL playground** (PGlite/WASM) with a 30-query index benchmark.

## Commands
```bash
npm run dev         # Vite dev server on :5173
npm test            # full Vitest suite (167 tests)
npm run test:watch  # watch mode
npm run typecheck   # tsc -b, no emit
npm run build       # tsc -b + vite build
```

## Layout & conventions
- `src/lib/**` is the framework-agnostic core and holds all tests (`__tests__/`). Keep it free of
  React imports. Add tests here when you change it.
- `src/features/**` are the React views (`analyzer`, `plan`, `playground`); `src/components/**`
  holds shared brutalist UI primitives and decorative shapes.
- **Analyzer rules** live in `src/lib/analyzer/rules/*.ts`, grouped by category, and are registered
  in `rules/index.ts` (`ALL_RULES`). Each rule's `detect(ctx)` returns `Detection[]` with an
  `index`/`length` into `ctx.raw`; the runner resolves positions and merges rule metadata. Rules
  scan `ctx.masked`/`ctx.lower` (string/comment contents blanked, length preserved) for structure,
  and read `ctx.raw` when they need literal contents. Add a positive **and** negative test per rule
  in `rules.test.ts`.
- **Plan parsers** live in `src/lib/plan/parsers/*.ts`, one per engine, each returning a
  `ParsedPlan` with a normalized `PlanNode` tree. `metrics.ts` derives self cost and row-estimate
  error. Sample fixtures for each engine are in `plan/samples.ts` (used by the UI and tests).
- **DB / benchmark**: `db/schema.ts` (seed via `generate_series`), `db/indexes.ts` (suggested
  indexes), `benchmark/queries.ts` (the 30 queries), `benchmark/runner.ts` (pure stats +
  orchestration against the `QueryExecutor` interface). The real PGlite client is `db/client.ts`.

## Notes
- PGlite must stay in `optimizeDeps.exclude` (WASM assets). Views are lazy-loaded and vendors are
  split via `manualChunks` in `vite.config.ts`.
- Design tokens are CSS custom properties in `src/styles/tokens.css`; prefer them over hard-coded
  colours.
- Do not edit source files while a long in-browser benchmark is running in dev — Vite HMR will
  remount the view and orphan the run.
