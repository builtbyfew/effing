import type { SKRSContext2D } from "@napi-rs/canvas";

import type { ComputedStyle } from "../style/compute.ts";
import { hasRadius, roundedRect } from "./clip.ts";
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

export function drawBoxShadow(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  boxShadow: string,
  borderRadius: ReturnType<typeof getBorderRadiusFromStyle>,
): void {
  // Parse simple box-shadow: offsetX offsetY blur spread? color
  const parts = boxShadow.match(
    /(-?\d+(?:\.\d+)?)\s*(?:px)?\s+(-?\d+(?:\.\d+)?)\s*(?:px)?\s+(-?\d+(?:\.\d+)?)\s*(?:px)?(?:\s+(-?\d+(?:\.\d+)?)\s*(?:px)?)?\s+(.*)/,
  );
  if (!parts) return;

  const offsetX = parseFloat(parts[1]!);
  const offsetY = parseFloat(parts[2]!);
  const blur = parseFloat(parts[3]!);
  const color = parts[5]!.trim();

  const radii = [
    borderRadius.topLeft,
    borderRadius.topRight,
    borderRadius.bottomRight,
    borderRadius.bottomLeft,
  ];

  // Clip to area OUTSIDE the element so shadow renders but inner fill is hidden
  const margin = blur * 2 + Math.abs(offsetX) + Math.abs(offsetY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - margin, y - margin, width + margin * 2, height + margin * 2);
  ctx.roundRect(x, y, width, height, radii);
  ctx.clip("evenodd");

  // Use CSS filter blur (sigma = blur/2) instead of the canvas shadow API
  // because it matches SVG feGaussianBlur (used by satori) much more closely.
  ctx.filter = `blur(${blur / 2}px)`;
  ctx.translate(offsetX, offsetY);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radii);
  ctx.fill();
  ctx.restore();
}
