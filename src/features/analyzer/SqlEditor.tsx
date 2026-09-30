import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import type { Dialect } from "../../lib/analyzer/types";
import { cmDialect, yestalgiaEditorTheme, yestalgiaHighlight } from "./editorTheme";

export function SqlEditor({
  value,
  onChange,
  dialect,
  height = "360px",
}: {
  value: string;
  onChange: (v: string) => void;
  dialect: Dialect;
  height?: string;
}) {
  const extensions = useMemo(
    () => [
      sql({ dialect: cmDialect(dialect), upperCaseKeywords: false }),
      yestalgiaHighlight,
      EditorView.lineWrapping,
    ],
    [dialect],
  );

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={yestalgiaEditorTheme}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        foldGutter: false,
      }}
    />
  );
}
