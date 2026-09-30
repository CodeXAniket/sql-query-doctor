/* Memphis / Y2K decorative shapes — lightning bolts, speckled arcs, zigzags,
   stars and grids. Purely decorative (aria-hidden), positioned by the caller. */

export function Bolt({ size = 64, color = "var(--lime-500)", className = "", style = {} }: DecorProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M38 4 L14 36 L30 36 L24 60 L52 26 L34 26 Z"
        fill={color}
        stroke="var(--black)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpeckleArc({ size = 90, className = "", style = {} }: DecorProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <pattern id="speck" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="var(--white)" />
          <circle cx="2" cy="2" r="1.1" fill="var(--black)" />
          <circle cx="7" cy="7" r="1.1" fill="var(--black)" />
        </pattern>
      </defs>
      <path
        d="M12 88 A 44 44 0 0 1 88 88"
        fill="none"
        stroke="url(#speck)"
        strokeWidth="20"
      />
      <path
        d="M12 88 A 44 44 0 0 1 88 88"
        fill="none"
        stroke="var(--black)"
        strokeWidth="22"
        strokeOpacity="1"
        style={{ mixBlendMode: "multiply" }}
        maskUnits="userSpaceOnUse"
        opacity={0}
      />
    </svg>
  );
}

export function Star({ size = 52, color = "var(--pink-400)", className = "", style = {} }: DecorProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M32 2 C34 24 40 30 62 32 C40 34 34 40 32 62 C30 40 24 34 2 32 C24 30 30 24 32 2 Z"
        fill={color}
        stroke="var(--black)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Blob({ size = 70, color = "var(--sky)", className = "", style = {} }: DecorProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="42"
        fill={color}
        stroke="var(--black)"
        strokeWidth="4"
        strokeDasharray="6 5"
      />
    </svg>
  );
}

interface DecorProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}
