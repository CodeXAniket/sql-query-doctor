import { useState } from "react";
import type { Finding } from "../../lib/analyzer/types";
import { CATEGORY_LABELS } from "../../lib/analyzer/types";
import { Badge } from "../../components/ui/primitives";

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function FindingCard({ finding, onLocate }: { finding: Finding; onLocate?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`finding finding--${finding.severity}`}>
      <button
        className="finding__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="finding__severity-rail" />
        <span className="finding__main">
          <span className="finding__title-row">
            <Badge tone={finding.severity} dot>
              {SEVERITY_LABEL[finding.severity]}
            </Badge>
            <span className="finding__title">{finding.title}</span>
          </span>
          <span className="finding__message">{finding.message}</span>
          <span className="finding__meta">
            <span className="chip">{CATEGORY_LABELS[finding.category]}</span>
            <span
              className="finding__loc"
              role={onLocate ? "button" : undefined}
              onClick={
                onLocate
                  ? (e) => {
                      e.stopPropagation();
                      onLocate();
                    }
                  : undefined
              }
            >
              line {finding.line}:{finding.column}
            </span>
          </span>
        </span>
        <span className="finding__chev" aria-hidden>
          {open ? "–" : "+"}
        </span>
      </button>

      {open && (
        <div className="finding__body">
          {finding.snippet && (
            <pre className="finding__snippet">
              <code>{finding.snippet}</code>
            </pre>
          )}
          <div className="finding__section">
            <h4>Why it's slow</h4>
            <p>{finding.explanation}</p>
          </div>
          <div className="finding__section">
            <h4>How to fix</h4>
            <p>{finding.suggestion}</p>
          </div>
          {finding.fix && (
            <div className="finding__section">
              <h4>Example</h4>
              <pre className="finding__snippet finding__snippet--fix">
                <code>{finding.fix}</code>
              </pre>
            </div>
          )}
          <div className="finding__ruleid">
            rule: <code>{finding.ruleId}</code>
          </div>
        </div>
      )}
    </div>
  );
}
