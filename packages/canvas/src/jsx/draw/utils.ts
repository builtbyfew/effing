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
