import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

export type TextMetrics = {
  width: number;
  ascent: number;
  descent: number;
  height: number;
};

// Scratch canvas for text measurement when no ctx is available
let scratchCtx: SKRSContext2D | null = null;

function getScratchCtx(): SKRSContext2D {
  if (!scratchCtx) {
    scratchCtx = createCanvas(1, 1).getContext("2d");
  }
  return scratchCtx;
}

/**
 * Set font properties on a canvas context for measurement.
 */
export function setFont(
  ctx: SKRSContext2D,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
): void {
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

/**
 * Measure text using the canvas ctx.measureText() API.
 * Returns width, ascent, descent, and total height.
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
  ctx?: SKRSContext2D,
): TextMetrics {
  const c = ctx ?? getScratchCtx();
  setFont(c, fontSize, fontFamily, fontWeight, fontStyle);

  const m = c.measureText(text);

  const ascent =
    m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent =
    m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontSize * 0.2;

  return {
    width: m.width,
    ascent,
    descent,
    height: ascent + descent,
  };
}

/**
 * Measure the width of a single word.
 */
export function measureWord(
  word: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
  ctx?: SKRSContext2D,
  letterSpacing: number = 0,
): number {
  const base = measureText(
    word,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    ctx,
  ).width;
  if (letterSpacing === 0 || word.length === 0) return base;
  return base + letterSpacing * word.length;
}
