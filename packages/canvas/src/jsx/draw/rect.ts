import type { SKRSContext2D } from "@effing/skia";

import type { ComputedStyle } from "../style/compute.ts";
import { hasRadius, maxCornerRadius, roundedRect } from "./clip.ts";
import type { Shadow } from "./shadow.ts";
import { parseCSSLength, toNumber, resolveBoxValue } from "./utils.ts";

/**
 * Draw the background, borders, and box-shadow for a rectangular element.
 */
export function drawRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ComputedStyle,
): void {
  const borderRadius = getBorderRadiusFromStyle(style, width, height);
  const hasRoundedCorners = hasRadius(borderRadius);

  // Background
  if (style.backgroundColor) {
    ctx.fillStyle = style.backgroundColor;

    if (hasRoundedCorners) {
      ctx.beginPath();
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
      ctx.fill();
    } else {
      ctx.fillRect(x, y, width, height);
    }
  }

  // Borders
  drawBorders(ctx, x, y, width, height, style, borderRadius);
}

function resolveRadius(v: unknown, width: number, height: number): number {
  if (typeof v === "string") return parseCSSLength(v, Math.min(width, height));
  return toNumber(v);
}

export function getBorderRadiusFromStyle(
  style: ComputedStyle,
  width: number,
  height: number,
) {
  return {
    topLeft: resolveRadius(style.borderTopLeftRadius, width, height),
    topRight: resolveRadius(style.borderTopRightRadius, width, height),
    bottomRight: resolveRadius(style.borderBottomRightRadius, width, height),
    bottomLeft: resolveRadius(style.borderBottomLeftRadius, width, height),
  };
}

function drawBorders(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ComputedStyle,
  borderRadius: ReturnType<typeof getBorderRadiusFromStyle>,
): void {
  const hasRoundedCorners = hasRadius(borderRadius);

  // If all borders are the same, draw as a single stroke
  const tw = resolveBoxValue(style.borderTopWidth, width);
  const rw = resolveBoxValue(style.borderRightWidth, width);
  const bw = resolveBoxValue(style.borderBottomWidth, width);
  const lw = resolveBoxValue(style.borderLeftWidth, width);

  if (tw === 0 && rw === 0 && bw === 0 && lw === 0) return;

  const allSameWidth = tw === rw && rw === bw && bw === lw && tw > 0;
  const tc = style.borderTopColor ?? "black";
  const rc = style.borderRightColor ?? "black";
  const bc = style.borderBottomColor ?? "black";
  const lc = style.borderLeftColor ?? "black";
  const allSameColor = tc === rc && rc === bc && bc === lc;

  if (allSameWidth && allSameColor) {
    ctx.strokeStyle = tc;
    ctx.lineWidth = tw;

    if (hasRoundedCorners) {
      ctx.beginPath();
      const half = tw / 2;
      roundedRect(
        ctx,
        x + half,
        y + half,
        width - tw,
        height - tw,
        Math.max(0, borderRadius.topLeft - half),
        Math.max(0, borderRadius.topRight - half),
        Math.max(0, borderRadius.bottomRight - half),
        Math.max(0, borderRadius.bottomLeft - half),
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(x + tw / 2, y + tw / 2, width - tw, height - tw);
    }
    return;
  }

  // Draw individual borders
  if (hasRoundedCorners) {
    const maxR = Math.min(width, height) / 2;
    const tl = Math.min(borderRadius.topLeft, maxR);
    const tr = Math.min(borderRadius.topRight, maxR);
    const br = Math.min(borderRadius.bottomRight, maxR);
    const bl = Math.min(borderRadius.bottomLeft, maxR);

    const top = y + tw / 2;
    const right = x + width - rw / 2;
    const bottom = y + height - bw / 2;
    const left = x + lw / 2;

    const eTL = Math.max(0, tl - Math.max(tw, lw) / 2);
    const eTR = Math.max(0, tr - Math.max(tw, rw) / 2);
    const eBR = Math.max(0, br - Math.max(bw, rw) / 2);
    const eBL = Math.max(0, bl - Math.max(bw, lw) / 2);

    // Each side owns its end corner (in drawing direction) and only draws the
    // start corner arc when the adjacent owner side is not visible (width 0).
    // This prevents double-stroking of corner arcs which causes AA artifacts.

    // Top side (L → R): borrows TL, owns TR
    if (tw > 0) {
      ctx.strokeStyle = tc;
      ctx.lineWidth = tw;
      ctx.beginPath();
      if (eTL > 0 && lw === 0) {
        ctx.moveTo(left, top + eTL);
        ctx.arcTo(left, top, left + eTL, top, eTL);
      } else if (eTL > 0) {
        ctx.moveTo(left + eTL, top);
      } else {
        ctx.moveTo(x, top);
      }
      if (eTR > 0) {
        ctx.lineTo(right - eTR, top);
        ctx.arcTo(right, top, right, top + eTR, eTR);
      } else {
        ctx.lineTo(x + width, top);
      }
      ctx.stroke();
    }

    // Right side (T → B): borrows TR, owns BR
    if (rw > 0) {
      ctx.strokeStyle = rc;
      ctx.lineWidth = rw;
      ctx.beginPath();
      if (eTR > 0 && tw === 0) {
        ctx.moveTo(right - eTR, top);
        ctx.arcTo(right, top, right, top + eTR, eTR);
      } else if (eTR > 0) {
        ctx.moveTo(right, top + eTR);
      } else {
        ctx.moveTo(right, y);
      }
      if (eBR > 0) {
        ctx.lineTo(right, bottom - eBR);
        ctx.arcTo(right, bottom, right - eBR, bottom, eBR);
      } else {
        ctx.lineTo(right, y + height);
      }
      ctx.stroke();
    }

    // Bottom side (R → L): borrows BR, owns BL
    if (bw > 0) {
      ctx.strokeStyle = bc;
      ctx.lineWidth = bw;
      ctx.beginPath();
      if (eBR > 0 && rw === 0) {
        ctx.moveTo(right, bottom - eBR);
        ctx.arcTo(right, bottom, right - eBR, bottom, eBR);
      } else if (eBR > 0) {
        ctx.moveTo(right - eBR, bottom);
      } else {
        ctx.moveTo(x + width, bottom);
      }
      if (eBL > 0) {
        ctx.lineTo(left + eBL, bottom);
        ctx.arcTo(left, bottom, left, bottom - eBL, eBL);
      } else {
        ctx.lineTo(x, bottom);
      }
      ctx.stroke();
    }

    // Left side (B → T): borrows BL, owns TL
    if (lw > 0) {
      ctx.strokeStyle = lc;
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (eBL > 0 && bw === 0) {
        ctx.moveTo(left + eBL, bottom);
        ctx.arcTo(left, bottom, left, bottom - eBL, eBL);
      } else if (eBL > 0) {
        ctx.moveTo(left, bottom - eBL);
      } else {
        ctx.moveTo(left, y + height);
      }
      if (eTL > 0) {
        ctx.lineTo(left, top + eTL);
        ctx.arcTo(left, top, left + eTL, top, eTL);
      } else {
        ctx.lineTo(left, y);
      }
      ctx.stroke();
    }
  } else {
    if (tw > 0) {
      ctx.strokeStyle = tc;
      ctx.lineWidth = tw;
      ctx.beginPath();
      ctx.moveTo(x, y + tw / 2);
      ctx.lineTo(x + width, y + tw / 2);
      ctx.stroke();
    }
    if (rw > 0) {
      ctx.strokeStyle = rc;
      ctx.lineWidth = rw;
      ctx.beginPath();
      ctx.moveTo(x + width - rw / 2, y);
      ctx.lineTo(x + width - rw / 2, y + height);
      ctx.stroke();
    }
    if (bw > 0) {
      ctx.strokeStyle = bc;
      ctx.lineWidth = bw;
      ctx.beginPath();
      ctx.moveTo(x, y + height - bw / 2);
      ctx.lineTo(x + width, y + height - bw / 2);
      ctx.stroke();
    }
    if (lw > 0) {
      ctx.strokeStyle = lc;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + lw / 2, y);
      ctx.lineTo(x + lw / 2, y + height);
      ctx.stroke();
    }
  }
}

type BorderRadius = ReturnType<typeof getBorderRadiusFromStyle>;

/** A colour no shadow is cast in: what an invalid colour leaves the fill. */
const NO_COLOR = "rgba(0, 0, 0, 0)";

/**
 * Draw an element's outer box shadows (those not `inset`), back to front:
 * the first listed is on top. Each is the border box grown by its spread
 * (shrunk, when negative), offset and blurred, and only shows outside the
 * border box.
 */
export function drawBoxShadow(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  shadows: Shadow[],
  borderRadius: BorderRadius,
): void {
  const outer = shadows.filter((s) => !s.inset);
  if (outer.length === 0) return;
  const radii = clampRadii(borderRadius, width, height);

  // Clip to the area outside the border box, far enough out for every shadow.
  let margin = 0;
  for (const s of outer) {
    margin = Math.max(margin, reach(s));
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - margin, y - margin, width + margin * 2, height + margin * 2);
  roundedRect(ctx, x, y, width, height, ...radii);
  ctx.clip("evenodd");

  for (let i = outer.length - 1; i >= 0; i--) {
    const s = outer[i]!;
    const w = width + s.spread * 2;
    const h = height + s.spread * 2;
    if (w <= 0 || h <= 0) continue;
    ctx.save();
    setShadowPaint(ctx, s);
    ctx.beginPath();
    roundedRect(
      ctx,
      x - s.spread + s.offsetX,
      y - s.spread + s.offsetY,
      w,
      h,
      ...spreadRadii(radii, s.spread),
    );
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Draw an element's `inset` box shadows, back to front: inside the padding
 * box and clipped to it. Each is the shadow outside a hole, the padding box
 * shrunk by the spread and offset, blurred into the box.
 */
export function drawInsetBoxShadow(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  shadows: Shadow[],
  borderRadius: BorderRadius,
  style: ComputedStyle,
): void {
  const inset = shadows.filter((s) => s.inset);
  if (inset.length === 0) return;

  const bt = resolveBoxValue(style.borderTopWidth, width);
  const br = resolveBoxValue(style.borderRightWidth, width);
  const bb = resolveBoxValue(style.borderBottomWidth, width);
  const bl = resolveBoxValue(style.borderLeftWidth, width);
  const px = x + bl;
  const py = y + bt;
  const pw = width - bl - br;
  const ph = height - bt - bb;
  if (pw <= 0 || ph <= 0) return;

  // The padding box's corners: the border box's, less the borders' widths.
  const [tl, tr, brr, bll] = clampRadii(borderRadius, width, height);
  const inner: Radii = [
    Math.max(0, tl - Math.max(bt, bl)),
    Math.max(0, tr - Math.max(bt, br)),
    Math.max(0, brr - Math.max(bb, br)),
    Math.max(0, bll - Math.max(bb, bl)),
  ];

  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, px, py, pw, ph, ...inner);
  ctx.clip();

  for (let i = inset.length - 1; i >= 0; i--) {
    const s = inset[i]!;
    // Far enough out that the shadow is solid where the blur reaches the box.
    const m = reach(s);
    ctx.save();
    setShadowPaint(ctx, s);
    ctx.beginPath();
    ctx.rect(px - m, py - m, pw + m * 2, ph + m * 2);
    const w = pw - s.spread * 2;
    const h = ph - s.spread * 2;
    if (w > 0 && h > 0) {
      roundedRect(
        ctx,
        px + s.spread + s.offsetX,
        py + s.spread + s.offsetY,
        w,
        h,
        ...spreadRadii(inner, -s.spread),
      );
    }
    ctx.fill("evenodd");
    ctx.restore();
  }
  ctx.restore();
}

/** How far a shadow can paint from the box it is cast by. */
function reach(s: Shadow): number {
  return (
    s.blur * 2 +
    Math.abs(s.offsetX) +
    Math.abs(s.offsetY) +
    Math.abs(s.spread) +
    1
  );
}

function setShadowPaint(ctx: SKRSContext2D, s: Shadow): void {
  // An invalid colour leaves the fill as it was: make that no colour.
  ctx.fillStyle = NO_COLOR;
  ctx.fillStyle = s.color;
  // Use a CSS blur filter (σ = blur / 2), as CSS defines the shadow's blur,
  // rather than the canvas shadow API.
  if (s.blur > 0) ctx.filter = `blur(${s.blur / 2}px)`;
}

/** Corner radii: top left, top right, bottom right, bottom left. */
type Radii = [number, number, number, number];

/** The radii as the box is drawn with them (see `roundedRect`). */
function clampRadii(r: BorderRadius, width: number, height: number): Radii {
  const max = maxCornerRadius(width, height);
  return [
    Math.min(r.topLeft, max),
    Math.min(r.topRight, max),
    Math.min(r.bottomRight, max),
    Math.min(r.bottomLeft, max),
  ];
}

/**
 * The corner radii of a shape grown by `spread` (shrunk, when negative), as
 * CSS has them: a radius grows by the spread, but one smaller than the spread
 * by less (a square corner stays square), and shrinks to no less than 0.
 */
export function spreadRadii(radii: Radii, spread: number): Radii {
  return radii.map((r) => spreadRadius(r, spread)) as Radii;
}

function spreadRadius(r: number, spread: number): number {
  if (spread <= 0) return Math.max(0, r + spread);
  if (r >= spread) return r + spread;
  // CSS Backgrounds 3, "Shadow shape, spread, and knockout".
  const ratio = r / spread;
  return r + spread * (1 + (ratio - 1) ** 3);
}
