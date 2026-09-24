// Compositing groups through the @effing/skia layer primitive
// (`ctx.beginLayer` / `ctx.endLayer`). Enabled with EFFING_LAYERS=1 when the
// loaded @napi-rs/canvas build provides it.

import type { SKRSContext2D } from "@napi-rs/canvas";

import { applyClip } from "./clip.ts";
import type { getBorderRadiusFromStyle } from "./rect.ts";

type BorderRadius = ReturnType<typeof getBorderRadiusFromStyle>;

export type LayerOptions = {
  opacity?: number;
  blendMode?: string;
  filter?: string;
  backdropFilter?: string;
  bounds?: [number, number, number, number];
};

export type LayerContext = SKRSContext2D & {
  beginLayer(options?: LayerOptions): void;
  endLayer(): void;
};

/** Whether nodes composite through native layers on this context. */
export function layersEnabled(ctx: SKRSContext2D): ctx is LayerContext {
  return (
    process.env.EFFING_LAYERS === "1" &&
    typeof (ctx as Partial<LayerContext>).beginLayer === "function"
  );
}

/**
 * CSS `backdrop-filter` as a native backdrop layer: the content behind the
 * border box (with its radius), filtered in the element's own coordinate
 * space and clamped at the edges, composited back at the element's opacity.
 * Skia reads the backdrop from the enclosing layer, so like a browser, an
 * ancestor with opacity or a filter bounds what the element sees through.
 */
export function drawBackdropLayer(
  ctx: LayerContext,
  filter: string,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: BorderRadius,
  opacity: number,
): void {
  if (width <= 0 || height <= 0) return;
  const normalized = filter.trim();
  if (!normalized || normalized === "none") return;
  ctx.save();
  applyClip(ctx, x, y, width, height, borderRadius);
  ctx.beginLayer({ backdropFilter: normalized, opacity });
  ctx.endLayer();
  ctx.restore();
}
