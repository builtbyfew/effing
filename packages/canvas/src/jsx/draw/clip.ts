import type { SKRSContext2D } from "@napi-rs/canvas";

/**
 * Apply overflow:hidden clipping to a canvas context.
 * Creates a rectangular clip path with optional border-radius.
 */
export function applyClip(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  },
): void {
  ctx.beginPath();

  if (borderRadius && hasRadius(borderRadius)) {
    const { topLeft, topRight, bottomRight, bottomLeft } = borderRadius;
    roundedRect(
      ctx,
      x,
      y,
      width,
      height,
      topLeft,
      topRight,
      bottomRight,
      bottomLeft,
    );
  } else {
    ctx.rect(x, y, width, height);
  }

  ctx.clip();
}

/**
 * Draw a rounded rectangle path on the context.
 */
export function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): void {
  // Clamp radii to half the smallest dimension
  const maxR = Math.min(w, h) / 2;
  tl = Math.min(tl, maxR);
  tr = Math.min(tr, maxR);
  br = Math.min(br, maxR);
  bl = Math.min(bl, maxR);

  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr > 0) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br > 0) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl > 0) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl > 0) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function hasRadius(r: {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}): boolean {
  return (
    r.topLeft > 0 || r.topRight > 0 || r.bottomRight > 0 || r.bottomLeft > 0
  );
}
