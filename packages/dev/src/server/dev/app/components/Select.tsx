import type { ReactNode } from "react";

type Size = "sm" | "md";

const SIZE_STYLES: Record<
  Size,
  {
    padding: string;
    fontSize: string;
    lineHeight: number;
    borderRadius: number;
    borderColor: string;
    chevronRight: string;
  }
> = {
  sm: {
    padding: "0.35rem 1.9rem 0.35rem 0.75rem",
    fontSize: "0.82rem",
    lineHeight: 1,
    borderRadius: 999,
    borderColor: "var(--color-coal-light-5)",
    chevronRight: "0.6rem",
  },
  md: {
    padding: "0.45rem 2.1rem 0.45rem 0.9rem",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    borderRadius: 6,
    borderColor: "var(--color-coal-light-4)",
    chevronRight: "0.75rem",
  },
};

export function Select({
  value,
  defaultValue,
  onChange,
  name,
  ariaLabel,
  size = "sm",
  children,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  ariaLabel?: string;
  size?: Size;
  children: ReactNode;
}) {
  const s = SIZE_STYLES[size];
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <select
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        name={name}
        aria-label={ariaLabel}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          background: "var(--color-snow)",
          border: `1px solid ${s.borderColor}`,
          borderRadius: s.borderRadius,
          padding: s.padding,
          fontFamily: "inherit",
          fontSize: s.fontSize,
          fontWeight: 600,
          color: "var(--color-coal)",
          cursor: "pointer",
          lineHeight: s.lineHeight,
        }}
      >
        {children}
      </select>
      <ChevronDown right={s.chevronRight} />
    </div>
  );
}

function ChevronDown({ right }: { right: string }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{
        position: "absolute",
        right,
        top: "50%",
        transform: "translateY(-50%)",
        pointerEvents: "none",
        color: "var(--color-coal-light-2)",
      }}
    >
      <path
        d="M3 4.75l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
