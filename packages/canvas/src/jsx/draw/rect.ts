import type { SKRSContext2D } from "@napi-rs/canvas";

import type { ComputedStyle } from "../style/compute.ts";
import { roundedRect } from "./clip.ts";
import { parseCSSLength, toNumber } from "./index.ts";

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
  const borderRadius = getBorderRadius(style, width, height);
  const hasRoundedCorners =
    borderRadius.topLeft > 0 ||
    borderRadius.topRight > 0 ||
    borderRadius.bottomRight > 0 ||
    borderRadius.bottomLeft > 0;

  // Box shadow (drawn before background)
  if (style.boxShadow) {
    drawBoxShadow(ctx, x, y, width, height, style.boxShadow, borderRadius);
  }

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

function getBorderRadius(style: ComputedStyle, width: number, height: number) {
  return {
    topLeft: resolveRadius(style.borderTopLeftRadius, width, height),
    topRight: resolveRadius(style.borderTopRightRadius, width, height),
    bottomRight: resolveRadius(style.borderBottomRightRadius, width, height),
    bottomLeft: resolveRadius(style.borderBottomLeftRadius, width, height),
  };
}

export function getBorderRadiusFromStyle(
  style: ComputedStyle,
  width: number,
  height: number,
) {
  return getBorderRadius(style, width, height);
}

function drawBorders(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ComputedStyle,
  borderRadius: ReturnType<typeof getBorderRadius>,
): void {
  const hasRoundedCorners =
    borderRadius.topLeft > 0 ||
    borderRadius.topRight > 0 ||
    borderRadius.bottomRight > 0 ||
    borderRadius.bottomLeft > 0;

  // If all borders are the same, draw as a single stroke
  const tw = toNumber(style.borderTopWidth);
  const rw = toNumber(style.borderRightWidth);
  const bw = toNumber(style.borderBottomWidth);
  const lw = toNumber(style.borderLeftWidth);

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

function drawBoxShadow(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  boxShadow: string,
  borderRadius: ReturnType<typeof getBorderRadius>,
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
