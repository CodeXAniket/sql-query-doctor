import type { SqlContext } from "./types";

/**
 * Run a global regex over the masked SQL and yield each match together with the
 * matching slice taken from the *raw* SQL (so reported snippets show the real
 * text, including any string contents the mask blanked out).
 */
export function* scan(
  ctx: SqlContext,
  re: RegExp,
): Generator<{ match: RegExpExecArray; rawSlice: string }> {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const rx = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = rx.exec(ctx.masked)) !== null) {
    yield { match: m, rawSlice: ctx.raw.slice(m.index, m.index + m[0].length) };
    if (m.index === rx.lastIndex) rx.lastIndex++; // guard against zero-width loops
  }
}

/** Locate the raw slice for a masked-space match (helper for readability). */
export function rawAt(ctx: SqlContext, index: number, length: number): string {
  return ctx.raw.slice(index, index + length);
}

/** Keyword offsets (in masked text) for a top-level clause keyword. */
export function keywordIndexes(ctx: SqlContext, keyword: string): number[] {
  const rx = new RegExp(`\\b${keyword}\\b`, "gi");
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(ctx.lower)) !== null) hits.push(m.index);
  return hits;
}

/**
 * Return the [start, end) offsets of each WHERE clause body in the masked SQL.
 * The body runs from just after `WHERE` up to the next top-level clause keyword
 * (GROUP BY / HAVING / ORDER BY / LIMIT / WINDOW / UNION / statement end),
 * respecting parenthesis depth so nested sub-selects don't end it early.
 */
export function whereRegions(ctx: SqlContext): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  const text = ctx.lower;
  const whereRe = /\bwhere\b/gi;
  let m: RegExpExecArray | null;
  while ((m = whereRe.exec(text)) !== null) {
    const start = m.index + m[0].length;
    let depth = 0;
    let i = start;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "(") depth++;
      else if (c === ")") {
        if (depth === 0) break; // closing paren of an enclosing subquery
        depth--;
      } else if (depth === 0) {
        if (c === ";") break;
        const rest = text.slice(i);
        if (
          /^\b(group\s+by|having|order\s+by|limit|offset|fetch|window|union|except|intersect|returning)\b/.test(
            rest,
          )
        ) {
          break;
        }
      }
    }
    regions.push({ start, end: i });
  }
  return regions;
}

/** True if the given masked offset falls within any WHERE / ON clause body. */
export function inWhereOrOn(ctx: SqlContext, index: number): boolean {
  for (const r of whereRegions(ctx)) {
    if (index >= r.start && index < r.end) return true;
  }
  // ON <cond> — treat the ~120 chars after an ON keyword as join-condition scope.
  const onRe = /\b(on)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = onRe.exec(ctx.lower)) !== null) {
    if (index >= m.index && index < m.index + 120) return true;
  }
  return false;
}
