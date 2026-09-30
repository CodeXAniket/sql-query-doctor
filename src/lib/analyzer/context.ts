import type { Dialect, SqlContext, SourceRange } from "./types";
import { parseSql } from "../parser/parse";

/**
 * Build a masked copy of the SQL where the *contents* of string literals and
 * comments are replaced with spaces, while newlines and overall length are
 * preserved. This lets structural regex scans (for keywords like WHERE, JOIN)
 * run without ever matching text that lives inside a string or comment.
 *
 * Supported: single-quoted strings ('...'), double-quoted identifiers ("..."),
 * backtick identifiers (`...`), line comments (-- ... and # ... for MySQL),
 * and block comments (/* ... *\/). Standard SQL '' escaping inside single
 * quotes is handled.
 */
export function maskSql(raw: string, dialect: Dialect): {
  masked: string;
  codeMask: boolean[];
} {
  const out = raw.split("");
  const codeMask = new Array<boolean>(raw.length).fill(true);
  const blank = (i: number) => {
    if (raw[i] !== "\n" && raw[i] !== "\r") out[i] = " ";
    codeMask[i] = false;
  };

  const allowHashComment = dialect === "mysql";
  let i = 0;
  const n = raw.length;
  while (i < n) {
    const c = raw[i];
    const next = raw[i + 1];

    // Line comment: --
    if (c === "-" && next === "-") {
      while (i < n && raw[i] !== "\n") blank(i++);
      continue;
    }
    // Line comment: # (MySQL)
    if (allowHashComment && c === "#") {
      while (i < n && raw[i] !== "\n") blank(i++);
      continue;
    }
    // Block comment: /* ... */
    if (c === "/" && next === "*") {
      blank(i++);
      blank(i++);
      while (i < n && !(raw[i] === "*" && raw[i + 1] === "/")) blank(i++);
      if (i < n) {
        blank(i++);
        blank(i++);
      }
      continue;
    }
    // Single-quoted string literal (with '' escape)
    if (c === "'") {
      blank(i++); // opening quote
      while (i < n) {
        if (raw[i] === "'" && raw[i + 1] === "'") {
          blank(i++);
          blank(i++);
          continue;
        }
        if (raw[i] === "'") break;
        blank(i++);
      }
      if (i < n) blank(i++); // closing quote
      continue;
    }
    // Double-quoted identifier
    if (c === '"') {
      blank(i++);
      while (i < n && raw[i] !== '"') blank(i++);
      if (i < n) blank(i++);
      continue;
    }
    // Backtick identifier (MySQL)
    if (c === "`") {
      blank(i++);
      while (i < n && raw[i] !== "`") blank(i++);
      if (i < n) blank(i++);
      continue;
    }
    i++;
  }

  return { masked: out.join(""), codeMask };
}

/** Build the full analysis context, including a best-effort AST parse. */
export function buildContext(rawInput: string, dialect: Dialect): SqlContext {
  const raw = rawInput.replace(/\r\n/g, "\n");
  const { masked, codeMask } = maskSql(raw, dialect);
  const parsed = parseSql(raw, dialect);
  return {
    raw,
    masked,
    lower: masked.toLowerCase(),
    codeMask,
    dialect,
    ast: parsed.ast,
    parseError: parsed.error,
  };
}

/** Convert a character offset into a 1-based line/column position. */
export function positionAt(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      last = i;
    }
  }
  return { line, column: index - last };
}

/** Expand a detection's (index, length) into a full SourceRange. */
export function toRange(text: string, index: number, length: number): SourceRange {
  const start = positionAt(text, index);
  const end = positionAt(text, index + length);
  return {
    index,
    length,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
  };
}
