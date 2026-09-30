import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import {
  PostgreSQL,
  MySQL,
  MSSQL,
  SQLite,
  type SQLDialect,
} from "@codemirror/lang-sql";
import type { Dialect } from "../../lib/analyzer/types";

export function cmDialect(dialect: Dialect): SQLDialect {
  switch (dialect) {
    case "postgresql":
      return PostgreSQL;
    case "mysql":
      return MySQL;
    case "transactsql":
      return MSSQL;
    case "sqlite":
      return SQLite;
  }
}

/** Solarized-light editor chrome matching the app palette. */
export const yestalgiaEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#fdf6e3",
      color: "#073642",
      fontSize: "14px",
      borderRadius: "8px",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', monospace",
      caretColor: "#d33682",
      padding: "14px 0",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#d33682", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "#2aa1983a",
    },
    ".cm-gutters": {
      backgroundColor: "#eee8d5",
      color: "#93a1a1",
      border: "none",
      borderRight: "2px solid #002b36",
      fontFamily: "'JetBrains Mono', monospace",
    },
    ".cm-activeLine": { backgroundColor: "#eee8d566" },
    ".cm-activeLineGutter": { backgroundColor: "#eee8d5", color: "#002b36" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 8px" },
    ".cm-selectionMatch": { backgroundColor: "#2aa19833" },
    ".cm-matchingBracket": {
      backgroundColor: "#2aa19855",
      outline: "1px solid #002b36",
    },
  },
  { dark: false },
);

export const yestalgiaHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "#859900", fontWeight: "700" },
    { tag: [t.string, t.special(t.string)], color: "#2aa198" },
    { tag: [t.number, t.bool, t.null], color: "#d33682", fontWeight: "700" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#268bd2" },
    { tag: t.operator, color: "#586e75" },
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#93a1a1", fontStyle: "italic" },
    { tag: [t.variableName, t.propertyName], color: "#073642" },
    { tag: t.typeName, color: "#b58900" },
    { tag: t.punctuation, color: "#657b83" },
  ]),
);
