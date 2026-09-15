import type { SKRSContext2D } from "@napi-rs/canvas";

import { hasRadius, roundedRect } from "./clip.ts";
import { acquireOffscreen, releaseOffscreen } from "./offscreen.ts";
import type { getBorderRadiusFromStyle } from "./rect.ts";

type BorderRadius = ReturnType<typeof getBorderRadiusFromStyle>;

/**
 * CSS `backdrop-filter`: filter whatever has already been painted behind the
 * element's border box and paint the result back, clipped to that box (with
 * its border radius). Must run before the element's own background so the
 * background composites on top of the filtered backdrop.
 *
 * The backdrop is everything drawn on the canvas so far — ancestors and
 * earlier siblings — which is exactly what a browser sees at that point in
 * paint order. The snapshot is taken in device space so it works under any
 * transform; filter lengths are scaled by the current transform's scale so a
 * `blur(10px)` stays 10 CSS pixels wide.
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

  // Device-space bounds of the (possibly transformed) border box.
  const m = ctx.getTransform();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ]) {
    const dx = m.a * px! + m.c * py! + m.e;
    const dy = m.b * px! + m.d * py! + m.f;
    if (dx < minX) minX = dx;
    if (dx > maxX) maxX = dx;
    if (dy < minY) minY = dy;
    if (dy > maxY) maxY = dy;
  }

  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const deviceFilter =
    scale === 1 ? normalized : scaleFilterLengths(normalized, scale);

  // Snapshot a margin around the box so blur near the edges samples real
  // backdrop pixels rather than the transparent void outside the snapshot.
  const pad = Math.ceil(filterBleed(normalized) * scale) + 1;
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const sx = Math.max(0, Math.floor(minX) - pad);
  const sy = Math.max(0, Math.floor(minY) - pad);
  const ex = Math.min(canvasW, Math.ceil(maxX) + pad);
  const ey = Math.min(canvasH, Math.ceil(maxY) + pad);
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw <= 0 || sh <= 0) return;

  const [offscreen, offCtx] = acquireOffscreen(sw, sh);
  offCtx.filter = deviceFilter;
  offCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  offCtx.filter = "none";

  ctx.save();
  ctx.beginPath();
  if (hasRadius(borderRadius)) {
    roundedRect(
      ctx,
      x,
      y,
      width,
      height,
      borderRadius.topLeft,
      borderRadius.topRight,
      borderRadius.bottomRight,
      borderRadius.bottomLeft,
    );
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.clip();
  // The element's own `filter` must not re-filter the backdrop.
  ctx.filter = "none";
  // Paint the snapshot back in device space; the clip above (set in user
  // space) still applies.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(offscreen, 0, 0, sw, sh, sx, sy, sw, sh);
  ctx.restore();
  releaseOffscreen(offscreen);
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
    /(-?\d*\.?\d+)px/g,
    (_, n: string) => `${parseFloat(n) * scale}px`,
  );
}
