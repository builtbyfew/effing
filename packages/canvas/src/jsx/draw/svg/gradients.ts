import { Path2D } from "@napi-rs/canvas";
import type {
  CanvasGradient,
  DOMMatrix2DInit,
  SKRSContext2D,
} from "@napi-rs/canvas";

import parseCssColor from "parse-css-color";

import type { BBox, SvgChild, SvgDefs } from "./types.ts";
import { normalizeChildren } from "./tree.ts";

type Viewport = SvgDefs["viewport"];

/** Parse a gradient coordinate percentage/fraction to a 0–1 value. */
function parseFrac(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const s = String(value);
  if (s.endsWith("%")) return parseFloat(s) / 100;
  return Number(s);
}

/** True when the gradient declares `gradientUnits="userSpaceOnUse"`. */
function isUserSpaceOnUse(props: Record<string, unknown>): boolean {
  return props.gradientUnits === "userSpaceOnUse";
}

/**
 * Parse a user-space gradient coordinate.  Percentages resolve against
 * `reference` (the relevant viewport dimension, per the SVG spec).
 */
function parseUserLength(
  value: unknown,
  fallback: number,
  reference: number,
): number {
  if (value == null) return fallback;
  const s = String(value);
  if (s.endsWith("%")) return (parseFloat(s) / 100) * reference;
  return Number(s);
}

/** Apply opacity to a CSS color string. */
export function applyOpacity(color: string, opacity: number): string {
  if (opacity >= 1) return color;
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  const [r, g, b] = parsed.values;
  return `rgba(${r}, ${g}, ${b}, ${parsed.alpha * opacity})`;
}

/** Add color stops from SVG `<stop>` children to a canvas gradient. */
function addGradientStops(gradient: CanvasGradient, def: SvgChild): void {
  for (const stop of normalizeChildren(def)) {
    if (stop.type !== "stop") continue;
    const sp = stop.props;
    const offsetRaw = (sp.offset as string | number) ?? 0;
    const offset =
      typeof offsetRaw === "string" && offsetRaw.endsWith("%")
        ? parseFloat(offsetRaw) / 100
        : Number(offsetRaw);
    const stopColor =
      ((sp.stopColor ?? sp["stop-color"]) as string | undefined) ?? "black";
    const stopOpacity = Number(sp.stopOpacity ?? sp["stop-opacity"] ?? 1);
    gradient.addColorStop(offset, applyOpacity(stopColor, stopOpacity));
  }
}

/** Create a linear gradient from bbox-relative coordinates with stops applied. */
function createLinearGradientFromBBox(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  bbox: BBox,
  def: SvgChild,
): CanvasGradient {
  const x1 = bbox.x + parseFrac(props.x1, 0) * bbox.width;
  const y1 = bbox.y + parseFrac(props.y1, 0) * bbox.height;
  const x2 = bbox.x + parseFrac(props.x2, 1) * bbox.width;
  const y2 = bbox.y + parseFrac(props.y2, 0) * bbox.height;
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  addGradientStops(gradient, def);
  return gradient;
}

/**
 * Create a linear gradient from `userSpaceOnUse` coordinates with stops
 * applied.  The coordinates are in the SVG user coordinate system, which is
 * the context's current coordinate system (the viewBox transform is active),
 * so they map to canvas gradient coordinates directly.
 */
function createLinearGradientUserSpace(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  viewport: Viewport,
  def: SvgChild,
): CanvasGradient {
  const x1 = parseUserLength(props.x1, 0, viewport.width);
  const y1 = parseUserLength(props.y1, 0, viewport.height);
  const x2 = parseUserLength(props.x2, viewport.width, viewport.width);
  const y2 = parseUserLength(props.y2, 0, viewport.height);
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  addGradientStops(gradient, def);
  return gradient;
}

/**
 * Create a radial gradient from `userSpaceOnUse` coordinates with stops
 * applied.  In user space the gradient is a true circle, so no elliptical
 * bbox transform is needed.  Percentage radii resolve against the
 * viewport's normalized diagonal, per the SVG spec.
 */
function createRadialGradientUserSpace(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  viewport: Viewport,
  def: SvgChild,
): CanvasGradient {
  const diagonal = Math.hypot(viewport.width, viewport.height) / Math.SQRT2;
  const cx = parseUserLength(props.cx, viewport.width / 2, viewport.width);
  const cy = parseUserLength(props.cy, viewport.height / 2, viewport.height);
  const r = parseUserLength(props.r, diagonal / 2, diagonal);
  const fx = parseUserLength(props.fx, cx, viewport.width);
  const fy = parseUserLength(props.fy, cy, viewport.height);
  const gradient = ctx.createRadialGradient(fx, fy, 0, cx, cy, r);
  addGradientStops(gradient, def);
  return gradient;
}

/**
 * Fill `path` with a gradient defined by `def` in the coordinate space of `bbox`.
 *
 * With `gradientUnits="userSpaceOnUse"` the gradient coordinates are already
 * in the SVG user coordinate system and are used as-is.
 *
 * With the default `objectBoundingBox` units, coordinates are fractions of
 * `bbox`.  For `<linearGradient>` the bbox-to-canvas mapping is
 * straightforward.  For `<radialGradient>` a non-square bbox produces an
 * *elliptical* gradient.  Canvas only supports circular radial gradients, so
 * we apply a non-uniform scale transform to the context and fill an
 * inverse-transformed copy of the path.
 */
export function fillWithSvgGradient(
  ctx: SKRSContext2D,
  def: SvgChild,
  bbox: BBox,
  path: Path2D,
  fillRule: CanvasFillRule,
  viewport: Viewport,
): boolean {
  const props = def.props;

  if (def.type === "linearGradient") {
    ctx.fillStyle = isUserSpaceOnUse(props)
      ? createLinearGradientUserSpace(ctx, props, viewport, def)
      : createLinearGradientFromBBox(ctx, props, bbox, def);
    ctx.fill(path, fillRule);
    return true;
  }

  if (def.type === "radialGradient" && isUserSpaceOnUse(props)) {
    ctx.fillStyle = createRadialGradientUserSpace(ctx, props, viewport, def);
    ctx.fill(path, fillRule);
    return true;
  }

  if (def.type === "radialGradient") {
    const cxF = parseFrac(props.cx, 0.5);
    const cyF = parseFrac(props.cy, 0.5);
    const rF = parseFrac(props.r, 0.5);
    const fxF = parseFrac(props.fx, cxF);
    const fyF = parseFrac(props.fy, cyF);

    // Render in a transformed space where the bbox maps to a unit square.
    // This turns canvas's circular radial gradient into the correct ellipse.
    ctx.save();
    ctx.translate(bbox.x, bbox.y);
    ctx.scale(bbox.width, bbox.height);

    const gradient = ctx.createRadialGradient(fxF, fyF, 0, cxF, cyF, rF);
    addGradientStops(gradient, def);
    ctx.fillStyle = gradient;

    // The path is in original (absolute) coordinates.  Inverse-transform it
    // into the unit-square space so the fill aligns with the shape.
    //   inverse of translate(bx,by) · scale(bw,bh)  =  scale(1/bw,1/bh) · translate(-bx,-by)
    const unitPath = new Path2D();
    const invTransform: DOMMatrix2DInit = {
      a: 1 / bbox.width,
      b: 0,
      c: 0,
      d: 1 / bbox.height,
      e: -bbox.x / bbox.width,
      f: -bbox.y / bbox.height,
    };
    unitPath.addPath(path, invTransform);

    ctx.fill(unitPath, fillRule);
    ctx.restore();
    return true;
  }

  return false;
}

/**
 * Stroke `path` with a gradient defined by `def` in the coordinate space of `bbox`.
 */
export function strokeWithSvgGradient(
  ctx: SKRSContext2D,
  def: SvgChild,
  bbox: BBox,
  path: Path2D,
  viewport: Viewport,
): boolean {
  const props = def.props;

  if (def.type === "linearGradient") {
    ctx.strokeStyle = isUserSpaceOnUse(props)
      ? createLinearGradientUserSpace(ctx, props, viewport, def)
      : createLinearGradientFromBBox(ctx, props, bbox, def);
    ctx.stroke(path);
    return true;
  }

  if (def.type === "radialGradient" && isUserSpaceOnUse(props)) {
    ctx.strokeStyle = createRadialGradientUserSpace(ctx, props, viewport, def);
    ctx.stroke(path);
    return true;
  }

  if (def.type === "radialGradient") {
    // For stroke, use a simple circular approximation (geometric mean radius)
    const cxAbs = bbox.x + parseFrac(props.cx, 0.5) * bbox.width;
    const cyAbs = bbox.y + parseFrac(props.cy, 0.5) * bbox.height;
    const rAbs = parseFrac(props.r, 0.5) * Math.sqrt(bbox.width * bbox.height);
    const fxAbs = bbox.x + parseFrac(props.fx, 0.5) * bbox.width;
    const fyAbs = bbox.y + parseFrac(props.fy, 0.5) * bbox.height;
    const gradient = ctx.createRadialGradient(
      fxAbs,
      fyAbs,
      0,
      cxAbs,
      cyAbs,
      rAbs,
    );
    addGradientStops(gradient, def);
    ctx.strokeStyle = gradient;
    ctx.stroke(path);
    return true;
  }

  return false;
}
