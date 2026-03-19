import type { InheritedSvgStyle } from "./types.ts";

/** Replace `"currentColor"` with the inherited CSS `color` value. */
export function resolveCurrentColor(
  value: string | undefined,
  color: string,
): string | undefined {
  if (value?.toLowerCase() === "currentcolor") return color;
  return value;
}

/**
 * Merge SVG presentation properties from `props.style` into the props object.
 * Style values win over direct props, matching browser CSS specificity rules.
 */
export function mergeStyleIntoProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const style = props.style as Record<string, unknown> | undefined;
  if (!style) return props;
  return { ...props, ...style };
}

/**
 * Parse an SVG length value, resolving percentages against a reference dimension.
 * Unlike gradient-specific `parseFrac`, this returns absolute coordinates (not 0–1 fractions).
 */
export function svgLength(
  value: unknown,
  reference: number,
  fallback = 0,
): number {
  if (value == null) return fallback;
  const s = String(value);
  if (s.endsWith("%")) return (parseFloat(s) / 100) * reference;
  const n = Number(s);
  return isNaN(n) ? fallback : n;
}

/** Parse `url(#id)` references and return the id, or undefined. */
export function parseUrlRef(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = value.match(/^url\(#(.+)\)$/);
  return m?.[1];
}

/**
 * Build an `InheritedSvgStyle` from merged SVG props, falling back to `parent`
 * values when present (for nested groups) or sensible defaults (fill = "black").
 */
export function resolveInheritedStyle(
  merged: Record<string, unknown>,
  color: string,
  parent?: InheritedSvgStyle,
): InheritedSvgStyle {
  return {
    fill:
      resolveCurrentColor(merged.fill as string | undefined, color) ??
      parent?.fill ??
      "black",
    stroke:
      resolveCurrentColor(merged.stroke as string | undefined, color) ??
      parent?.stroke,
    strokeWidth:
      ((merged.strokeWidth ?? merged["stroke-width"]) as
        | string
        | number
        | undefined) ?? parent?.strokeWidth,
    strokeLinecap:
      ((merged.strokeLinecap ?? merged["stroke-linecap"]) as
        | string
        | undefined) ?? parent?.strokeLinecap,
    strokeLinejoin:
      ((merged.strokeLinejoin ?? merged["stroke-linejoin"]) as
        | string
        | undefined) ?? parent?.strokeLinejoin,
    strokeOpacity:
      ((merged.strokeOpacity ?? merged["stroke-opacity"]) as
        | string
        | number
        | undefined) ?? parent?.strokeOpacity,
  };
}
