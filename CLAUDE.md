# CLAUDE.md

Guidance for working in this repository.

## What this is
SQL Query Doctor — a React + TypeScript web app: a multi-dialect SQL anti-pattern **analyzer** that
lints a query for performance anti-patterns and, for each finding, explains why it's slow and how to
fix it. Runs 100% in the browser, no backend.

## Commands
```bash
npm run dev         # Vite dev server on :5173
npm test            # full Vitest suite (94 tests)
npm run test:watch  # watch mode
npm run typecheck   # tsc -b, no emit
npm run build       # tsc -b + vite build
```

## Layout & conventions
- `src/lib/**` is the framework-agnostic core and holds all tests (`__tests__/`). Keep it free of
  React imports. Add tests here when you change it.
- `src/features/analyzer/**` is the React view; `src/components/**` holds shared brutalist UI
  primitives and decorative shapes.
- **Analyzer rules** live in `src/lib/analyzer/rules/*.ts`, grouped by category, and are registered
  in `rules/index.ts` (`ALL_RULES`). Each rule's `detect(ctx)` returns `Detection[]` with an
  `index`/`length` into `ctx.raw`; the runner resolves positions and merges rule metadata. Rules
  scan `ctx.masked`/`ctx.lower` (string/comment contents blanked, length preserved) for structure,
  and read `ctx.raw` when they need literal contents. Add a positive **and** negative test per rule
  in `rules.test.ts`.
- **Parsing**: `src/lib/parser/parse.ts` wraps `node-sql-parser` (4 dialects) and captures parse
  errors instead of throwing, so linting still runs on unparseable SQL.

## Notes
- Design tokens are CSS custom properties in `src/styles/tokens.css`; prefer them over hard-coded
  colours.
- Vendor chunks (react / editor / sql-parser) are split via `manualChunks` in `vite.config.ts`.
