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
  const tw = Math.max(0, resolveBoxValue(style.borderTopWidth, width));
  const rw = Math.max(0, resolveBoxValue(style.borderRightWidth, width));
  const bw = Math.max(0, resolveBoxValue(style.borderBottomWidth, width));
  const lw = Math.max(0, resolveBoxValue(style.borderLeftWidth, width));
  // A negative width, which CSS doesn't allow, is none.
  if (tw === 0 && rw === 0 && bw === 0 && lw === 0) return;

  const sides: BorderSide[] = [
    { width: tw, color: style.borderTopColor ?? "black" },
    { width: rw, color: style.borderRightColor ?? "black" },
    { width: bw, color: style.borderBottomColor ?? "black" },
    { width: lw, color: style.borderLeftColor ?? "black" },
  ];
  const visible = sides.filter((s) => s.width > 0);

  // The border area: the border box less the padding box, whose corners'
  // radii are the border box's less the adjoining widths, on each axis.
  const [tl, tr, br, bl] = clampRadii(borderRadius, width, height);
  const pw = width - lw - rw;
  const ph = height - tw - bw;
  const inner: [number, number][] = [
    [Math.max(0, tl - lw), Math.max(0, tl - tw)],
    [Math.max(0, tr - rw), Math.max(0, tr - tw)],
    [Math.max(0, br - rw), Math.max(0, br - bw)],
    [Math.max(0, bl - lw), Math.max(0, bl - bw)],
  ];
  const fillArea = (color: string) => {
    // An invalid colour leaves the fill as it was: make that no colour.
    ctx.fillStyle = NO_COLOR;
    ctx.fillStyle = color;
    ctx.beginPath();
    roundedRect(ctx, x, y, width, height, tl, tr, br, bl);
    if (pw > 0 && ph > 0) ellipticalRect(ctx, x + lw, y + tw, pw, ph, inner);
    ctx.fill("evenodd");
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
  // it, which covers it there.
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

interface BorderSide {
  width: number;
  color: string;
}

function isOpaque(side: BorderSide): boolean {
  return side.width > 0 && (parseCssColor(side.color)?.alpha ?? 0) === 1;
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
  radii: [number, number][],
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
