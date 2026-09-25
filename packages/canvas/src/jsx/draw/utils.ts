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

/** A 2D affine matrix in DOMMatrix `a b c d e f` order. */
export type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/** Axis-aligned device-space bounds of a user-space rectangle under `m`. */
export function transformedBounds(
  m: Matrix,
  x: number,
  y: number,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [px, py] of [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ] as const) {
    const dx = m.a * px + m.c * py + m.e;
    const dy = m.b * px + m.d * py + m.f;
    if (dx < x0) x0 = dx;
    if (dx > x1) x1 = dx;
    if (dy < y0) y0 = dy;
    if (dy > y1) y1 = dy;
  }
  return { x0, y0, x1, y1 };
}
