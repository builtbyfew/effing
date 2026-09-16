/**
 * Shared CSS utility functions used by the draw system.
 */

export function parseCSSLength(value: string, referenceSize: number): number {
  if (value.endsWith("%")) return (parseFloat(value) / 100) * referenceSize;
  return parseFloat(value);
}

export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/**
 * Resolve a box-model value (padding, border-width) that may be a percentage.
 * Per CSS spec, percentage padding/border resolves against the element's width
 * (even for top/bottom).
 */
export function resolveBoxValue(v: unknown, referenceWidth: number): number {
  if (typeof v === "number") return v;
  if (v === undefined || v === null) return 0;
  const s = String(v);
  if (s.endsWith("%")) return (parseFloat(s) / 100) * referenceWidth;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Format a number for embedding in a CSS string. `String(n)` switches to
 * exponent notation for very small or large magnitudes (`1e-7`), which CSS
 * parsers reject, so round to six decimals and print positionally.
 */
export function formatCSSNumber(n: number): string {
  const fixed = n.toFixed(6).replace(/\.?0+$/, "");
  return fixed === "-0" || fixed === "" ? "0" : fixed;
}
