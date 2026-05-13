import type { ReactNode } from "react";

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "0.75rem 1rem",
        backgroundColor: "var(--color-coal)",
        color: "var(--color-coal-light-6)",
        border: "1px solid var(--color-coal-light-1)",
        borderRadius: 6,
        overflow: "auto",
        fontSize: "0.78rem",
        lineHeight: 1.5,
      }}
    >
      {children}
    </pre>
  );
}
