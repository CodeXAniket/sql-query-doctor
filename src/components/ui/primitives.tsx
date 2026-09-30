import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import type { Severity } from "../../lib/analyzer/types";

type ButtonVariant = "primary" | "secondary" | "pink" | "ink" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    variant !== "primary" && `btn--${variant}`,
    size !== "md" && `btn--${size}`,
    block && "btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Badge({
  tone,
  children,
  dot,
}: {
  tone?: Severity | "ok" | "neutral";
  children: ReactNode;
  dot?: boolean;
}) {
  const cls = ["badge", tone && tone !== "neutral" && `badge--${tone}`, dot && "badge--dot"]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children}</span>;
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export function Select({ options, className = "", ...rest }: SelectProps) {
  return (
    <select className={`select ${className}`} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__opt"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
