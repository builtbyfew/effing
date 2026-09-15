import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";

import { applyClip } from "./clip.ts";
import { acquireOffscreen, releaseOffscreen } from "./offscreen.ts";
import type { getBorderRadiusFromStyle } from "./rect.ts";
import { formatCSSNumber } from "./utils.ts";

type BorderRadius = ReturnType<typeof getBorderRadiusFromStyle>;

/** A 2D affine matrix in DOMMatrix `a b c d e f` order. */
type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/**
 * CSS `backdrop-filter`: filter whatever has already been painted behind the
 * element's border box and paint the result back, clipped to that box (with
 * its border radius). Must run before the element's own painting — box-shadow
 * and background included — so nothing of the element ends up in its own
 * backdrop and the background composites on top of the filtered result.
 *
 * The backdrop is everything drawn on the canvas so far — ancestors and
 * earlier siblings — which is exactly what a browser sees at that point in
 * paint order. The snapshot is taken from the canvas in device space, with the
 * canvas edge extended outward the way a browser clamps the backdrop at the
 * viewport edge, so a blur near the edge doesn't fade into transparency.
 *
 * Filter lengths are CSS pixels of the element. Under a uniform scale or a
 * rotation the filter runs directly on the device-space snapshot with its
 * lengths scaled; under a non-uniform scale or skew the snapshot is first
 * mapped into the element's own space (where the filter is isotropic),
 * filtered there and drawn back under the element's transform.
 */
export function drawBackdropFilter(
  ctx: SKRSContext2D,
  filter: string,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: BorderRadius,
): void {
  if (width <= 0 || height <= 0) return;
  const normalized = filter.trim();
  if (!normalized || normalized === "none") return;

  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) return; // Degenerate transform: nothing is visible.

  // Grow the box by the filter's reach so a blur at the box edge samples the
  // real backdrop rather than the void past the snapshot.
  const pad = Math.ceil(filterBleed(normalized)) + 1;
  const bx = x - pad;
  const by = y - pad;
  const bw = width + 2 * pad;
  const bh = height + 2 * pad;

  // Device-space pixel bounds of the padded box, deliberately not clamped to
  // the canvas: `drawExtendedBackdrop` fills the part outside it.
  const bounds = transformedBounds(m, bx, by, bw, bh);
  const rx = Math.floor(bounds.x0);
  const ry = Math.floor(bounds.y0);
  const rw = Math.ceil(bounds.x1) - rx;
  const rh = Math.ceil(bounds.y1) - ry;
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  // Entirely off-canvas: the backdrop is transparent, nothing to filter.
  if (rx + rw <= 0 || ry + rh <= 0 || rx >= canvasW || ry >= canvasH) return;

  // A similarity transform (uniform scale and/or rotation) keeps the filter
  // isotropic in device space, so the snapshot can stay in device pixels.
  const sx = Math.hypot(m.a, m.b);
  const sy = Math.hypot(m.c, m.d);
  const eps = 1e-6 * Math.max(sx, sy);
  const similar =
    Math.abs(sx - sy) <= eps && Math.abs(m.a * m.c + m.b * m.d) <= eps * sx;

  let bufW: number;
  let bufH: number;
  let scale: number;
  if (similar) {
    bufW = rw;
    bufH = rh;
    scale = sx;
  } else {
    // Element-space buffer at the transform's largest axis scale, so the
    // stretched axis loses no resolution.
    scale = Math.max(sx, sy);
    bufW = Math.ceil(bw * scale);
    bufH = Math.ceil(bh * scale);
  }
  if (bufW <= 0 || bufH <= 0) return;

  const [snapshot, snapCtx] = acquireOffscreen(bufW, bufH);
  if (similar) {
    snapCtx.translate(-rx, -ry);
  } else {
    // Map device space into the buffer: undo the element transform, move the
    // padded box to the origin and scale up to buffer resolution.
    const inv = invert(m, det);
    snapCtx.setTransform(
      scale * inv.a,
      scale * inv.b,
      scale * inv.c,
      scale * inv.d,
      scale * (inv.e - bx),
      scale * (inv.f - by),
    );
  }
  drawExtendedBackdrop(snapCtx, ctx.canvas, rx, ry, rw, rh);

  const filtered = filterSnapshot(snapshot, normalized, scale);
  releaseOffscreen(snapshot);

  ctx.save();
  applyClip(ctx, x, y, width, height, borderRadius);
  // The element's own `filter` must not re-filter the backdrop.
  ctx.filter = "none";
  if (similar) {
    // Paint back in device space; the clip above (set in user space) still
    // applies.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(filtered, 0, 0, bufW, bufH, rx, ry, bufW, bufH);
  } else {
    ctx.drawImage(filtered, 0, 0, bufW, bufH, bx, by, bw, bh);
  }
  ctx.restore();
  releaseOffscreen(filtered);
}

/**
 * Copy the device-space region `rx, ry, rw, rh` of `canvas` onto `target`
 * (whose transform maps device space into the target buffer). Parts of the
 * region past the canvas edge are filled by stretching the boundary pixels
 * outward, so a filter near the edge samples the edge colour rather than
 * transparency.
 */
function drawExtendedBackdrop(
  target: SKRSContext2D,
  canvas: Canvas,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): void {
  const cw = canvas.width;
  const ch = canvas.height;
  const ix0 = Math.max(rx, 0);
  const iy0 = Math.max(ry, 0);
  const ix1 = Math.min(rx + rw, cw);
  const iy1 = Math.min(ry + rh, ch);
  if (ix1 <= ix0 || iy1 <= iy0) return;
  const iw = ix1 - ix0;
  const ih = iy1 - iy0;
  target.drawImage(canvas, ix0, iy0, iw, ih, ix0, iy0, iw, ih);

  const left = ix0 - rx;
  const right = rx + rw - ix1;
  const top = iy0 - ry;
  const bottom = ry + rh - iy1;
  if (left > 0) target.drawImage(canvas, 0, iy0, 1, ih, rx, iy0, left, ih);
  if (right > 0) {
    target.drawImage(canvas, cw - 1, iy0, 1, ih, ix1, iy0, right, ih);
  }
  if (top > 0) target.drawImage(canvas, ix0, 0, iw, 1, ix0, ry, iw, top);
  if (bottom > 0) {
    target.drawImage(canvas, ix0, ch - 1, iw, 1, ix0, iy1, iw, bottom);
  }
  if (left > 0 && top > 0) {
    target.drawImage(canvas, 0, 0, 1, 1, rx, ry, left, top);
  }
  if (right > 0 && top > 0) {
    target.drawImage(canvas, cw - 1, 0, 1, 1, ix1, ry, right, top);
  }
  if (left > 0 && bottom > 0) {
    target.drawImage(canvas, 0, ch - 1, 1, 1, rx, iy1, left, bottom);
  }
  if (right > 0 && bottom > 0) {
    target.drawImage(canvas, cw - 1, ch - 1, 1, 1, ix1, iy1, right, bottom);
  }
}

/** Draw `snapshot` through `filter` (lengths scaled by `scale`) into a new buffer. */
function filterSnapshot(
  snapshot: Canvas,
  filter: string,
  scale: number,
): Canvas {
  const [out, outCtx] = acquireOffscreen(snapshot.width, snapshot.height);
  outCtx.filter = scale === 1 ? filter : scaleFilterLengths(filter, scale);
  outCtx.drawImage(snapshot, 0, 0);
  outCtx.filter = "none";
  return out;
}

/** Axis-aligned device-space bounds of a user-space rectangle under `m`. */
function transformedBounds(
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

function invert(m: Matrix, det: number): Matrix {
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

/**
 * How far (in CSS px) a filter can pull pixels from outside its input: three
 * standard deviations per blur, plus the offset and blur of drop-shadows.
 */
export function filterBleed(filter: string): number {
  let bleed = 0;
  for (const m of filter.matchAll(/blur\(\s*(-?\d*\.?\d+)(?:px)?\s*\)/g)) {
    bleed += Math.abs(parseFloat(m[1]!)) * 3;
  }
  for (const m of filter.matchAll(/drop-shadow\(([^)]*)\)/g)) {
    const nums = m[1]!.match(/-?\d*\.?\d+(?=px|\s|$)/g) ?? [];
    const [ox = "0", oy = "0", blur = "0"] = nums;
    bleed +=
      Math.abs(parseFloat(ox)) +
      Math.abs(parseFloat(oy)) +
      Math.abs(parseFloat(blur)) * 3;
  }
  return bleed;
}

/** Multiply every `px` length in a filter string by `scale`. */
export function scaleFilterLengths(filter: string, scale: number): string {
  return filter.replace(
    /(?<![\w.])(-?\d*\.?\d+)px/g,
    (_, n: string) => `${formatCSSNumber(parseFloat(n) * scale)}px`,
  );
}
