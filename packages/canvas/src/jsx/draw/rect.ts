import type { SKRSContext2D } from "@effing/skia";
import parseCssColor from "parse-css-color";

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

/**
 * Draw an element's borders as CSS does: each side fills its part of the
 * area between the border box and the padding box. The padding box's corners
 * are the border box's, less the adjoining borders' widths on each axis, so
 * they are elliptical where the widths differ, and a border tapers to nothing
 * where it meets a side without one.
 */
function drawBorders(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ComputedStyle,
  borderRadius: BorderRadius,
): void {
  const [tw, rw, bw, lw] = borderWidths(style, width);
  if (tw === 0 && rw === 0 && bw === 0 && lw === 0) return;

  // Skia doesn't know currentColor: it's the element's colour, which is also
  // a border's colour when none is given.
  const color = (c: string | undefined) =>
    c === undefined || c.trim().toLowerCase() === "currentcolor"
      ? (style.color ?? "black")
      : c;
  const sides: BorderSide[] = [
    { width: tw, color: color(style.borderTopColor) },
    { width: rw, color: color(style.borderRightColor) },
    { width: bw, color: color(style.borderBottomColor) },
    { width: lw, color: color(style.borderLeftColor) },
  ];
  const visible = sides.filter((s) => s.width > 0);

  // The border area: the border box less the padding box.
  const outer = clampRadii(borderRadius, width, height);
  const [tl, tr, br, bl] = outer;
  const padding = paddingBox(x, y, width, height, [tw, rw, bw, lw], outer);
  const { width: pw, height: ph, radii: inner, scaled } = padding;
  const fillArea = (color: string) => {
    // An invalid colour leaves the fill as it was: make that no colour.
    ctx.fillStyle = NO_COLOR;
    ctx.fillStyle = color;
    ctx.beginPath();
    roundedRect(ctx, x, y, width, height, tl, tr, br, bl);
    if (pw <= 0 || ph <= 0) {
      ctx.fill();
      return;
    }
    // Where a padding box corner reaches past the border box's curve, as
    // only a radius scaled down can, it paints nothing: clipped to the border
    // box. Only then, as the clip antialiases the curve a second time.
    if (scaled) {
      ctx.save();
      ctx.clip();
    }
    ellipticalRect(ctx, padding.x, padding.y, pw, ph, inner);
    ctx.fill("evenodd");
    if (scaled) ctx.restore();
  };

  // Sides of one colour are filled at once, without seams between them.
  if (visible.every((s) => s.color === visible[0]!.color)) {
    fillArea(visible[0]!.color);
    return;
  }

  // Otherwise each side is clipped to its part of the border area: the
  // corners are split along the line from the border box's corner to the
  // padding box's, as browsers do. The line runs on past the padding box's
  // corner, when it is rounded, to the chord across its curve, so that the
  // part of the border that curves round the corner is on it.
  const splits = [
    [x, y, x + lw, y + tw, 1, 1],
    [x + width, y, x + width - rw, y + tw, -1, 1],
    [x + width, y + height, x + width - rw, y + height - bw, -1, -1],
    [x, y + height, x + lw, y + height - bw, 1, -1],
  ].map(([ox, oy, ix, iy, sx, sy], i): [Point, Point] => {
    const [rx, ry] = inner[i]!;
    const dx = ix! - ox!;
    const dy = iy! - oy!;
    let t = 1;
    if (rx > 0 || ry > 0) {
      // Where the line crosses the chord from (ix + rx, iy) to (ix, iy + ry).
      const ex = -sx! * rx;
      const ey = sy! * ry;
      const ax = ix! + sx! * rx - ox!;
      const ay = iy! - oy!;
      const denom = dx * ey - dy * ex;
      if (denom !== 0) t = Math.max(1, (ax * ey - ay * ex) / denom);
    }
    // From outside the box, so that its edge is filled to the full.
    return [
      [ox! - dx, oy! - dy],
      [ox! + dx * t, oy! + dy * t],
    ];
  });
  // Two sides clipped along the same line would each cover only part of the
  // pixels on it, and the background would show through between them. So
  // each side runs a pixel past its split with an opaque side drawn after
  // it, which covers it there, but for the pixels where that pixel-wide band
  // crosses the curves: there the side drawn after it is antialiased over
  // it, and a little of its colour shows in a pixel or two at each corner.
  // Cutting the sides to the curves only once they are all drawn would need
  // an offscreen layer per border.
  const mids: Point[] = [
    [x + width / 2, y],
    [x + width, y + height / 2],
    [x + width / 2, y + height],
    [x, y + height / 2],
  ];
  const split = (k: number, side: number): [Point, Point] => {
    const [o, p] = splits[k % 4]!;
    const next = k % 4 === side ? (side + 3) % 4 : (side + 1) % 4;
    if (next <= side || !isOpaque(sides[next]!)) return [o, p];
    // A pixel towards the next side.
    const len = Math.hypot(p[0] - o[0], p[1] - o[1]);
    let nx = (o[1] - p[1]) / len;
    let ny = (p[0] - o[0]) / len;
    const [mx, my] = mids[next]!;
    if (nx * (mx - o[0]) + ny * (my - o[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [
      [o[0] + nx, o[1] + ny],
      [p[0] + nx, p[1] + ny],
    ];
  };
  for (let i = 0; i < 4; i++) {
    const side = sides[i]!;
    if (side.width === 0) continue;
    const [o1, i1] = split(i, i);
    const [o2, i2] = split(i + 1, i);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...o1);
    ctx.lineTo(...o2);
    ctx.lineTo(...i2);
    ctx.lineTo(...i1);
    ctx.closePath();
    ctx.clip();
    fillArea(side.color);
    ctx.restore();
  }
}

type Point = [number, number];

/**
 * An element's border widths, top, right, bottom and left. A negative width,
 * which CSS doesn't allow, is none.
 */
function borderWidths(
  style: ComputedStyle,
  width: number,
): [number, number, number, number] {
  return [
    Math.max(0, resolveBoxValue(style.borderTopWidth, width)),
    Math.max(0, resolveBoxValue(style.borderRightWidth, width)),
    Math.max(0, resolveBoxValue(style.borderBottomWidth, width)),
    Math.max(0, resolveBoxValue(style.borderLeftWidth, width)),
  ];
}

/** Elliptical corner radii, each `[horizontal, vertical]` (see `ellipticalRect`). */
type EllipticalRadii = [number, number][];

interface PaddingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: EllipticalRadii;
  /**
   * Whether the radii were scaled down to fit, so that a corner can reach
   * past the border box's curve.
   */
  scaled: boolean;
}

/**
 * The padding box of a border box with the given border widths (top, right,
 * bottom, left) and corner radii (as drawn: see `clampRadii`), as CSS has it:
 * its corners' radii are the border box's less the adjoining borders' widths,
 * on each axis, so they are elliptical where the widths differ.
 */
function paddingBox(
  x: number,
  y: number,
  width: number,
  height: number,
  [tw, rw, bw, lw]: [number, number, number, number],
  [tl, tr, br, bl]: Radii,
): PaddingBox {
  const pw = width - lw - rw;
  const ph = height - tw - bw;
  const { radii, scaled } = fitRadii(
    [
      [Math.max(0, tl - lw), Math.max(0, tl - tw)],
      [Math.max(0, tr - rw), Math.max(0, tr - tw)],
      [Math.max(0, br - rw), Math.max(0, br - bw)],
      [Math.max(0, bl - lw), Math.max(0, bl - bw)],
    ],
    pw,
    ph,
  );
  return { x: x + lw, y: y + tw, width: pw, height: ph, radii, scaled };
}

/**
 * The radii scaled down to fit a `w` × `h` box, as CSS does, when they take
 * more room than it has on a side.
 */
function fitRadii(
  radii: EllipticalRadii,
  w: number,
  h: number,
): { radii: EllipticalRadii; scaled: boolean } {
  const fit = Math.min(
    1,
    w / (radii[0]![0] + radii[1]![0]),
    w / (radii[3]![0] + radii[2]![0]),
    h / (radii[0]![1] + radii[3]![1]),
    h / (radii[1]![1] + radii[2]![1]),
  );
  // Not when the box is empty, which has no room to fit them in.
  if (!(fit < 1 && fit > 0)) return { radii, scaled: false };
  return {
    radii: radii.map(([rx, ry]): [number, number] => [rx * fit, ry * fit]),
    scaled: true,
  };
}

interface BorderSide {
  width: number;
  color: string;
}

function isOpaque(side: BorderSide): boolean {
  return side.width > 0 && (parseCssColor(side.color.trim())?.alpha ?? 0) === 1;
}

/**
 * Add a rectangle with elliptical corners to the path, each corner's radii
 * given as `[horizontal, vertical]`: top left, top right, bottom right,
 * bottom left. The radii must fit the rectangle.
 */
function ellipticalRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: EllipticalRadii,
): void {
  // Each corner: where it is, which way the rectangle lies from it, and the
  // angle its arc starts at, clockwise from the side before it.
  const corners = [
    [x, y, 1, 1, Math.PI],
    [x + w, y, -1, 1, (3 * Math.PI) / 2],
    [x + w, y + h, -1, -1, 0],
    [x, y + h, 1, -1, Math.PI / 2],
  ] as const;
  ctx.moveTo(x, y + radii[0]![1]);
  for (let i = 0; i < 4; i++) {
    const [px, py, sx, sy, start] = corners[i]!;
    const [rx, ry] = radii[i]!;
    if (rx > 0 && ry > 0) {
      ctx.ellipse(
        px + sx * rx,
        py + sy * ry,
        rx,
        ry,
        0,
        start,
        start + Math.PI / 2,
      );
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
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

  const outer = clampRadii(borderRadius, width, height);
  const padding = paddingBox(
    x,
    y,
    width,
    height,
    borderWidths(style, width),
    outer,
  );
  const { x: px, y: py, width: pw, height: ph, radii } = padding;
  if (pw <= 0 || ph <= 0) return;

  ctx.save();
  // Where a padding box corner reaches past the border box's curve, as only
  // a radius scaled down can, it is clipped to the border box, as the
  // borders are.
  if (padding.scaled) {
    ctx.beginPath();
    roundedRect(ctx, x, y, width, height, ...outer);
    ctx.clip();
  }
  ctx.beginPath();
  ellipticalRect(ctx, px, py, pw, ph, radii);
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
      // The hole's radii, on each axis, shrunk by the spread (grown, when
      // negative), and scaled down to fit it.
      const hole = radii.map(([rx, ry]): [number, number] => [
        spreadRadius(rx, -s.spread),
        spreadRadius(ry, -s.spread),
      ]);
      ellipticalRect(
        ctx,
        px + s.spread + s.offsetX,
        py + s.spread + s.offsetY,
        w,
        h,
        fitRadii(hole, w, h).radii,
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
