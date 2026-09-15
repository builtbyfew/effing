import { Path2D } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import type { ComputedStyle } from "../style/compute.ts";
import { getBorderRadiusFromStyle } from "./rect.ts";
import { parseCSSLength, resolveBoxValue } from "./utils.ts";

/**
 * CSS `clip-path` support: basic shapes (`inset()`, `circle()`, `ellipse()`,
 * `polygon()`, `path()`, `rect()`, `xywh()`), the newer `shape()` function and
 * an optional geometry box (`border-box`, `padding-box`, `content-box`,
 * `margin-box`). Lengths other than `%` are already resolved to pixels by the
 * style pipeline; percentages resolve against the reference box here.
 *
 * `url(#id)` references and `calc()` are not supported — an unrecognised value
 * leaves the element unclipped, matching how a browser drops an invalid
 * declaration.
 */

export type FillRule = "nonzero" | "evenodd";

type Point = [number, number];

/** Per-corner elliptical radii, in the order tl, tr, br, bl. */
export type CornerRadii = [Point, Point, Point, Point];

export type ReferenceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A resolved clip shape in absolute canvas coordinates.
 */
export type ClipShape =
  | { kind: "none" }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      radii: CornerRadii | null;
    }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "polygon"; points: Point[]; fillRule: FillRule }
  | { kind: "path"; d: string; dx: number; dy: number; fillRule: FillRule };

const GEOMETRY_BOXES = new Set([
  "border-box",
  "padding-box",
  "content-box",
  "margin-box",
  "fill-box",
  "stroke-box",
  "view-box",
]);

const H_KEYWORDS = new Map<string, number>([
  ["left", 0],
  ["x-start", 0],
  ["center", 0.5],
  ["right", 1],
  ["x-end", 1],
]);

const V_KEYWORDS = new Map<string, number>([
  ["top", 0],
  ["y-start", 0],
  ["center", 0.5],
  ["bottom", 1],
  ["y-end", 1],
]);

const ARC_OPTIONS = new Set(["of", "cw", "ccw", "large", "small", "rotate"]);

/**
 * Clip the context to the element's `clip-path`. Must be called after the
 * element's transform has been applied (clip-path lives in the element's own
 * coordinate space) and before anything of the element is painted — box-shadow
 * included, since clip-path clips the element's entire rendering.
 */
export function applyClipPath(
  ctx: SKRSContext2D,
  clipPath: string,
  style: ComputedStyle,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const shape = parseClipPath(clipPath, style, { x, y, width, height });
  if (!shape || shape.kind === "none") return;
  const path = clipShapeToPath(shape);
  ctx.clip(path, shapeFillRule(shape));
}

function shapeFillRule(shape: ClipShape): FillRule {
  return shape.kind === "polygon" || shape.kind === "path"
    ? shape.fillRule
    : "nonzero";
}

/**
 * Parse a `clip-path` value into a resolved shape in absolute coordinates.
 * `box` is the element's border box; `style` supplies the border, padding and
 * margin widths used for the other geometry boxes. Returns `null` for values
 * that can't be parsed.
 */
export function parseClipPath(
  value: string,
  style: ComputedStyle,
  box: ReferenceBox,
): ClipShape | null {
  const trimmed = value.trim();
  if (trimmed === "none") return { kind: "none" };

  // Split into an optional shape function and an optional geometry box, in
  // either order: `circle(50%) padding-box` or `padding-box circle(50%)`.
  let fn: { name: string; args: string } | null = null;
  let geometryBox = "border-box";
  const fnMatch = trimmed.match(/^(.*?)([a-z]+)\((.*)\)(.*)$/s);
  let keywords: string[];
  if (fnMatch) {
    fn = { name: fnMatch[2]!, args: fnMatch[3]! };
    keywords = [fnMatch[1]!, fnMatch[4]!]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);
  } else {
    keywords = trimmed.split(/\s+/).filter(Boolean);
  }
  for (const kw of keywords) {
    if (!GEOMETRY_BOXES.has(kw)) return null;
    geometryBox = kw;
  }
  if (!fn && keywords.length === 0) return null;

  const ref = resolveReferenceBox(geometryBox, style, box);
  const { width: w, height: h } = ref;

  if (!fn) {
    // A bare geometry box clips to that box, following the border radius
    // (reduced by the border/padding widths for the inner boxes).
    return {
      kind: "rect",
      x: ref.x,
      y: ref.y,
      width: w,
      height: h,
      radii: referenceBoxRadii(geometryBox, style, box, ref),
    };
  }

  switch (fn.name) {
    case "inset":
      return parseInset(fn.args, ref);
    case "rect":
      return parseRect(fn.args, ref);
    case "xywh":
      return parseXywh(fn.args, ref);
    case "circle":
      return parseCircle(fn.args, ref);
    case "ellipse":
      return parseEllipse(fn.args, ref);
    case "polygon":
      return parsePolygon(fn.args, ref);
    case "path":
      return parsePath(fn.args, ref);
    case "shape":
      return parseShape(fn.args, ref);
    default:
      return null;
  }
}

/**
 * Build a `Path2D` for a resolved clip shape.
 */
export function clipShapeToPath(shape: ClipShape): Path2D {
  const p = new Path2D();
  switch (shape.kind) {
    case "none":
      break;
    case "rect":
      if (shape.radii && shape.width > 0 && shape.height > 0) {
        roundedRectPath(
          p,
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.radii,
        );
      } else {
        p.rect(
          shape.x,
          shape.y,
          Math.max(0, shape.width),
          Math.max(0, shape.height),
        );
      }
      break;
    case "circle":
      if (shape.r > 0) p.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
      break;
    case "ellipse":
      if (shape.rx > 0 && shape.ry > 0) {
        p.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      }
      break;
    case "polygon":
      if (shape.points.length >= 3) {
        const [first, ...rest] = shape.points;
        p.moveTo(first![0], first![1]);
        for (const [px, py] of rest) p.lineTo(px, py);
        p.closePath();
      }
      break;
    case "path": {
      const inner = new Path2D(shape.d);
      if (shape.dx === 0 && shape.dy === 0) return inner;
      p.addPath(inner, { a: 1, b: 0, c: 0, d: 1, e: shape.dx, f: shape.dy });
      break;
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// Reference boxes
// ---------------------------------------------------------------------------

function resolveReferenceBox(
  geometryBox: string,
  style: ComputedStyle,
  box: ReferenceBox,
): ReferenceBox {
  const { x, y, width, height } = box;
  switch (geometryBox) {
    case "padding-box": {
      const t = resolveBoxValue(style.borderTopWidth, width);
      const r = resolveBoxValue(style.borderRightWidth, width);
      const b = resolveBoxValue(style.borderBottomWidth, width);
      const l = resolveBoxValue(style.borderLeftWidth, width);
      return {
        x: x + l,
        y: y + t,
        width: width - l - r,
        height: height - t - b,
      };
    }
    case "content-box": {
      const t =
        resolveBoxValue(style.borderTopWidth, width) +
        resolveBoxValue(style.paddingTop, width);
      const r =
        resolveBoxValue(style.borderRightWidth, width) +
        resolveBoxValue(style.paddingRight, width);
      const b =
        resolveBoxValue(style.borderBottomWidth, width) +
        resolveBoxValue(style.paddingBottom, width);
      const l =
        resolveBoxValue(style.borderLeftWidth, width) +
        resolveBoxValue(style.paddingLeft, width);
      return {
        x: x + l,
        y: y + t,
        width: width - l - r,
        height: height - t - b,
      };
    }
    case "margin-box": {
      const t = marginValue(style.marginTop, width);
      const r = marginValue(style.marginRight, width);
      const b = marginValue(style.marginBottom, width);
      const l = marginValue(style.marginLeft, width);
      return {
        x: x - l,
        y: y - t,
        width: width + l + r,
        height: height + t + b,
      };
    }
    default:
      return box;
  }
}

function marginValue(v: unknown, referenceWidth: number): number {
  if (v === "auto") return 0;
  return resolveBoxValue(v, referenceWidth);
}

/**
 * Border radii of a geometry box: the element's border-radius for the border
 * box (and margin box, grown by the margin), reduced by the border and padding
 * widths for the inner boxes. Returns `null` when every corner is square.
 */
function referenceBoxRadii(
  geometryBox: string,
  style: ComputedStyle,
  box: ReferenceBox,
  ref: ReferenceBox,
): CornerRadii | null {
  const br = getBorderRadiusFromStyle(style, box.width, box.height);
  const base: [number, number, number, number] = [
    br.topLeft,
    br.topRight,
    br.bottomRight,
    br.bottomLeft,
  ];
  if (base.every((r) => r <= 0)) return null;

  // Horizontal / vertical insets from the border box to the reference box, per
  // corner: (left, top), (right, top), (right, bottom), (left, bottom).
  const left = ref.x - box.x;
  const top = ref.y - box.y;
  const right = box.x + box.width - (ref.x + ref.width);
  const bottom = box.y + box.height - (ref.y + ref.height);
  const insets: [Point, Point, Point, Point] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];

  const radii = base.map((r, i) => {
    const [ix, iy] = insets[i]!;
    return [Math.max(0, r - ix), Math.max(0, r - iy)] as Point;
  }) as CornerRadii;
  if (radii.every(([rx, ry]) => rx <= 0 || ry <= 0)) return null;
  return normalizeRadii(radii, ref.width, ref.height);
}

// ---------------------------------------------------------------------------
// Basic shapes
// ---------------------------------------------------------------------------

function parseInset(args: string, ref: ReferenceBox): ClipShape | null {
  const [insetPart, roundPart] = splitRound(args);
  const values = tokenize(insetPart);
  if (values.length < 1 || values.length > 4) return null;
  const [t, r, b, l] = expandSides(values);
  const top = parseCSSLength(t, ref.height);
  const right = parseCSSLength(r, ref.width);
  const bottom = parseCSSLength(b, ref.height);
  const left = parseCSSLength(l, ref.width);
  if ([top, right, bottom, left].some(isNaN)) return null;
  return makeRect(
    ref.x + left,
    ref.y + top,
    ref.width - left - right,
    ref.height - top - bottom,
    roundPart,
  );
}

function parseRect(args: string, ref: ReferenceBox): ClipShape | null {
  const [rectPart, roundPart] = splitRound(args);
  const values = tokenize(rectPart);
  if (values.length !== 4) return null;
  const [t, r, b, l] = values as [string, string, string, string];
  const top = t === "auto" ? 0 : parseCSSLength(t, ref.height);
  const right = r === "auto" ? ref.width : parseCSSLength(r, ref.width);
  const bottom = b === "auto" ? ref.height : parseCSSLength(b, ref.height);
  const left = l === "auto" ? 0 : parseCSSLength(l, ref.width);
  if ([top, right, bottom, left].some(isNaN)) return null;
  // Per spec, right/bottom are clamped so they never precede left/top.
  const x2 = Math.max(left, right);
  const y2 = Math.max(top, bottom);
  return makeRect(ref.x + left, ref.y + top, x2 - left, y2 - top, roundPart);
}

function parseXywh(args: string, ref: ReferenceBox): ClipShape | null {
  const [xywhPart, roundPart] = splitRound(args);
  const values = tokenize(xywhPart);
  if (values.length !== 4) return null;
  const [xs, ys, ws, hs] = values as [string, string, string, string];
  const x = parseCSSLength(xs, ref.width);
  const y = parseCSSLength(ys, ref.height);
  const w = parseCSSLength(ws, ref.width);
  const h = parseCSSLength(hs, ref.height);
  if ([x, y, w, h].some(isNaN)) return null;
  return makeRect(
    ref.x + x,
    ref.y + y,
    Math.max(0, w),
    Math.max(0, h),
    roundPart,
  );
}

function makeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  roundPart: string | undefined,
): ClipShape | null {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  let radii: CornerRadii | null = null;
  if (roundPart !== undefined) {
    const parsed = parseRadii(roundPart, w, h);
    if (parsed === undefined) return null;
    radii = parsed;
  }
  return { kind: "rect", x, y, width: w, height: h, radii };
}

function parseCircle(args: string, ref: ReferenceBox): ClipShape | null {
  const [radiusPart, posPart] = splitAt(args);
  const radiusTokens = tokenize(radiusPart);
  if (radiusTokens.length > 1) return null;
  const pos = resolvePosition(tokenize(posPart ?? ""), ref.width, ref.height);
  if (!pos) return null;
  const [cx, cy] = pos;
  const closest = Math.min(cx, cy, ref.width - cx, ref.height - cy);
  const farthest = Math.max(cx, cy, ref.width - cx, ref.height - cy);
  const percentBase = Math.hypot(ref.width, ref.height) / Math.SQRT2;
  const r = resolveRadius(radiusTokens[0], closest, farthest, percentBase);
  if (r === undefined) return null;
  return { kind: "circle", cx: ref.x + cx, cy: ref.y + cy, r: Math.max(0, r) };
}

function parseEllipse(args: string, ref: ReferenceBox): ClipShape | null {
  const [radiusPart, posPart] = splitAt(args);
  const radiusTokens = tokenize(radiusPart);
  if (radiusTokens.length !== 0 && radiusTokens.length !== 2) return null;
  const pos = resolvePosition(tokenize(posPart ?? ""), ref.width, ref.height);
  if (!pos) return null;
  const [cx, cy] = pos;
  const rx = resolveRadius(
    radiusTokens[0],
    Math.min(cx, ref.width - cx),
    Math.max(cx, ref.width - cx),
    ref.width,
  );
  const ry = resolveRadius(
    radiusTokens[1],
    Math.min(cy, ref.height - cy),
    Math.max(cy, ref.height - cy),
    ref.height,
  );
  if (rx === undefined || ry === undefined) return null;
  return {
    kind: "ellipse",
    cx: ref.x + cx,
    cy: ref.y + cy,
    rx: Math.max(0, rx),
    ry: Math.max(0, ry),
  };
}

function parsePolygon(args: string, ref: ReferenceBox): ClipShape | null {
  const parts = splitArgs(args);
  let fillRule: FillRule = "nonzero";
  const first = parts[0]?.trim();
  if (first === "nonzero" || first === "evenodd") {
    fillRule = first;
    parts.shift();
  }
  const points: Point[] = [];
  for (const part of parts) {
    const pair = tokenize(part);
    if (pair.length !== 2) return null;
    const px = parseCSSLength(pair[0]!, ref.width);
    const py = parseCSSLength(pair[1]!, ref.height);
    if (isNaN(px) || isNaN(py)) return null;
    points.push([ref.x + px, ref.y + py]);
  }
  if (points.length === 0) return null;
  return { kind: "polygon", points, fillRule };
}

function parsePath(args: string, ref: ReferenceBox): ClipShape | null {
  const parts = splitArgs(args);
  let fillRule: FillRule = "nonzero";
  const first = parts[0]?.trim();
  if (first === "nonzero" || first === "evenodd") {
    fillRule = first;
    parts.shift();
  }
  if (parts.length !== 1) return null;
  const d = unquote(parts[0]!.trim());
  if (!d) return null;
  return { kind: "path", d, dx: ref.x, dy: ref.y, fillRule };
}

// ---------------------------------------------------------------------------
// shape()
// ---------------------------------------------------------------------------

/**
 * Parse the `shape()` function into SVG path data. Coordinates are resolved
 * against the reference box; the resulting path is positioned at the box
 * origin via `dx`/`dy`.
 *
 * Grammar (CSS Shapes 2): `shape([<fill-rule>]? from <x> <y>, <command>#)`
 * with commands `move`, `line`, `hline`, `vline`, `curve`, `smooth`, `arc`
 * and `close`, each using `to` (absolute) or `by` (relative to the current
 * point).
 */
function parseShape(args: string, ref: ReferenceBox): ClipShape | null {
  const { width: w, height: h } = ref;
  const parts = splitArgs(args);
  const first = parts.shift()?.trim();
  if (!first) return null;

  const startMatch = first.match(/^(?:(nonzero|evenodd)\s+)?from\s+(.+)$/s);
  if (!startMatch) return null;
  const fillRule = (startMatch[1] ?? "nonzero") as FillRule;

  let current = resolvePoint(tokenize(startMatch[2]!), w, h);
  if (!current) return null;
  let subpathStart = current;
  let d = `M${fmtPoint(current)}`;

  for (const part of parts) {
    const tokens = tokenize(part);
    const command = tokens.shift();

    switch (command) {
      case "close": {
        if (tokens.length) return null;
        d += " Z";
        current = subpathStart;
        break;
      }
      case "move":
      case "line": {
        const end = resolveEndpoint(tokens, current, w, h);
        if (!end) return null;
        d += ` ${command === "move" ? "M" : "L"}${fmtPoint(end)}`;
        current = end;
        if (command === "move") subpathStart = end;
        break;
      }
      case "hline":
      case "vline": {
        const [mode, token, ...rest] = tokens;
        if ((mode !== "to" && mode !== "by") || !token || rest.length) {
          return null;
        }
        const axis = command === "hline" ? 0 : 1;
        const base = axis === 0 ? w : h;
        const keywords = axis === 0 ? H_KEYWORDS : V_KEYWORDS;
        const kw = keywords.get(token);
        const resolved =
          mode === "to" && kw !== undefined
            ? kw * base
            : parseCSSLength(token, base);
        if (isNaN(resolved)) return null;
        const next: Point = [current[0], current[1]];
        next[axis] = mode === "by" ? current[axis] + resolved : resolved;
        d += axis === 0 ? ` H${fmt(next[0])}` : ` V${fmt(next[1])}`;
        current = next;
        break;
      }
      case "curve":
      case "smooth": {
        const withIndex = tokens.indexOf("with");
        const endTokens =
          withIndex === -1 ? tokens : tokens.slice(0, withIndex);
        const controlTokens =
          withIndex === -1 ? [] : tokens.slice(withIndex + 1);
        const mode = endTokens[0];
        const end = resolveEndpoint(endTokens, current, w, h);
        if (!end) return null;
        if (command === "curve" && withIndex === -1) return null;

        const controls: Point[] = [];
        for (const control of splitAtSlash(controlTokens)) {
          const point = resolveControlPoint(control, mode, current, end, w, h);
          if (!point) return null;
          controls.push(point);
        }

        if (command === "curve") {
          if (controls.length === 1) {
            d += ` Q${fmtPoint(controls[0]!)} ${fmtPoint(end)}`;
          } else if (controls.length === 2) {
            d += ` C${fmtPoint(controls[0]!)} ${fmtPoint(controls[1]!)} ${fmtPoint(end)}`;
          } else {
            return null;
          }
        } else if (controls.length === 0) {
          d += ` T${fmtPoint(end)}`;
        } else if (controls.length === 1) {
          d += ` S${fmtPoint(controls[0]!)} ${fmtPoint(end)}`;
        } else {
          return null;
        }
        current = end;
        break;
      }
      case "arc": {
        const optionIndex = tokens.findIndex((t) => ARC_OPTIONS.has(t));
        const endTokens =
          optionIndex === -1 ? tokens : tokens.slice(0, optionIndex);
        const options = optionIndex === -1 ? [] : tokens.slice(optionIndex);
        const end = resolveEndpoint(endTokens, current, w, h);
        if (!end) return null;

        let rx = 0;
        let ry = 0;
        let rotation = 0;
        let large = 0;
        let sweep = 0;
        for (let i = 0; i < options.length; i++) {
          const option = options[i]!;
          if (option === "of") {
            const r1 = options[++i];
            if (!r1) return null;
            const r2 = options[i + 1];
            const hasSecond = r2 !== undefined && !ARC_OPTIONS.has(r2);
            if (hasSecond) {
              i++;
              rx = parseCSSLength(r1, w);
              ry = parseCSSLength(r2!, h);
            } else {
              rx = ry = parseCSSLength(r1, Math.hypot(w, h) / Math.SQRT2);
            }
            if (isNaN(rx) || isNaN(ry)) return null;
          } else if (option === "cw" || option === "ccw") {
            sweep = option === "cw" ? 1 : 0;
          } else if (option === "large" || option === "small") {
            large = option === "large" ? 1 : 0;
          } else if (option === "rotate") {
            const angle = options[++i];
            if (!angle) return null;
            rotation = parseAngleDegrees(angle);
            if (isNaN(rotation)) return null;
          } else {
            return null;
          }
        }
        d += ` A${fmt(Math.abs(rx))} ${fmt(Math.abs(ry))} ${fmt(rotation)} ${large} ${sweep} ${fmtPoint(end)}`;
        current = end;
        break;
      }
      default:
        return null;
    }
  }

  return { kind: "path", d, dx: ref.x, dy: ref.y, fillRule };
}

function resolveEndpoint(
  tokens: string[],
  current: Point,
  w: number,
  h: number,
): Point | null {
  const mode = tokens[0];
  if (mode !== "to" && mode !== "by") return null;
  const point = resolvePoint(tokens.slice(1), w, h);
  if (!point) return null;
  return mode === "by" ? [current[0] + point[0], current[1] + point[1]] : point;
}

/**
 * A control point: `<x> <y> [from start | end | origin]?`. Without `from`,
 * `by` commands measure from the segment start and `to` commands from the
 * reference box origin.
 */
function resolveControlPoint(
  tokens: string[],
  mode: string | undefined,
  start: Point,
  end: Point,
  w: number,
  h: number,
): Point | null {
  let origin: "start" | "end" | "origin" = mode === "by" ? "start" : "origin";
  let coords = tokens;
  const fromIndex = tokens.indexOf("from");
  if (fromIndex !== -1) {
    const ref = tokens[fromIndex + 1];
    if (
      (ref !== "start" && ref !== "end" && ref !== "origin") ||
      tokens.length !== fromIndex + 2
    ) {
      return null;
    }
    origin = ref;
    coords = tokens.slice(0, fromIndex);
  }
  const point = resolvePoint(coords, w, h);
  if (!point) return null;
  const base: Point =
    origin === "start" ? start : origin === "end" ? end : [0, 0];
  return [base[0] + point[0], base[1] + point[1]];
}

/** Resolve a `<coordinate-pair>` (lengths, percentages or position keywords). */
function resolvePoint(tokens: string[], w: number, h: number): Point | null {
  if (tokens.length !== 2) return null;
  const x = resolveAxis(tokens[0]!, w, H_KEYWORDS);
  const y = resolveAxis(tokens[1]!, h, V_KEYWORDS);
  if (isNaN(x) || isNaN(y)) return null;
  return [x, y];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a CSS `<position>` (as used after `at`) to a point relative to the
 * reference box. Defaults to the center.
 */
function resolvePosition(tokens: string[], w: number, h: number): Point | null {
  if (tokens.length === 0) return [w / 2, h / 2];

  if (tokens.length === 1) {
    const t = tokens[0]!;
    if (V_KEYWORDS.has(t) && !H_KEYWORDS.has(t)) {
      return [w / 2, V_KEYWORDS.get(t)! * h];
    }
    const x = resolveAxis(t, w, H_KEYWORDS);
    return isNaN(x) ? null : [x, h / 2];
  }

  if (tokens.length === 2) {
    let [a, b] = tokens as [string, string];
    // Keywords may come in either order ("top left" == "left top").
    if (
      (V_KEYWORDS.has(a) && !H_KEYWORDS.has(a)) ||
      (H_KEYWORDS.has(b) && !V_KEYWORDS.has(b))
    ) {
      [a, b] = [b, a];
    }
    const x = resolveAxis(a, w, H_KEYWORDS);
    const y = resolveAxis(b, h, V_KEYWORDS);
    return isNaN(x) || isNaN(y) ? null : [x, y];
  }

  // 3–4 tokens: edge keywords with optional offsets, e.g. "right 10px bottom 20px".
  let x = w / 2;
  let y = h / 2;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1];
    const hasOffset =
      next !== undefined && !H_KEYWORDS.has(next) && !V_KEYWORDS.has(next);
    if (t === "left" || t === "right") {
      const off = hasOffset ? parseCSSLength(next!, w) : 0;
      if (isNaN(off)) return null;
      x = t === "left" ? off : w - off;
    } else if (t === "top" || t === "bottom") {
      const off = hasOffset ? parseCSSLength(next!, h) : 0;
      if (isNaN(off)) return null;
      y = t === "top" ? off : h - off;
    } else if (t !== "center") {
      return null;
    }
    if (hasOffset) i++;
  }
  return [x, y];
}

function resolveAxis(
  token: string,
  size: number,
  keywords: Map<string, number>,
): number {
  const kw = keywords.get(token);
  if (kw !== undefined) return kw * size;
  return parseCSSLength(token, size);
}

function resolveRadius(
  token: string | undefined,
  closestSide: number,
  farthestSide: number,
  percentBase: number,
): number | undefined {
  if (token === undefined || token === "closest-side") return closestSide;
  if (token === "farthest-side") return farthestSide;
  const r = parseCSSLength(token, percentBase);
  return isNaN(r) ? undefined : r;
}

/**
 * Parse `border-radius`-style radii (`r1 r2 r3 r4 / v1 v2 v3 v4`) into
 * per-corner elliptical radii, scaled down per the CSS overlap rule. Returns
 * `undefined` for unparsable input and `null` when all corners are square.
 */
function parseRadii(
  value: string,
  w: number,
  h: number,
): CornerRadii | null | undefined {
  const [hPart, vPart] = value.split("/");
  const hTokens = tokenize(hPart ?? "");
  const vTokens = vPart === undefined ? hTokens : tokenize(vPart);
  if (
    hTokens.length < 1 ||
    hTokens.length > 4 ||
    vTokens.length < 1 ||
    vTokens.length > 4
  ) {
    return undefined;
  }
  const hs = expandSides(hTokens).map((t) => parseCSSLength(t, w));
  const vs = expandSides(vTokens).map((t) => parseCSSLength(t, h));
  if ([...hs, ...vs].some(isNaN)) return undefined;
  const radii = hs.map((rx, i) => [
    Math.max(0, rx),
    Math.max(0, vs[i]!),
  ]) as CornerRadii;
  if (radii.every(([rx, ry]) => rx <= 0 || ry <= 0)) return null;
  return normalizeRadii(radii, w, h);
}

/**
 * CSS border-radius overlap rule: if adjacent radii along any side sum to more
 * than that side's length, scale every radius by the same factor.
 */
function normalizeRadii(radii: CornerRadii, w: number, h: number): CornerRadii {
  const [tl, tr, br, bl] = radii;
  let f = 1;
  const consider = (sum: number, length: number) => {
    if (sum > 0 && length / sum < f) f = length / sum;
  };
  consider(tl[0] + tr[0], w);
  consider(bl[0] + br[0], w);
  consider(tl[1] + bl[1], h);
  consider(tr[1] + br[1], h);
  if (f >= 1) return radii;
  return radii.map(([rx, ry]) => [rx * f, ry * f]) as CornerRadii;
}

/**
 * Append a rounded rectangle with per-corner elliptical radii to a path.
 */
function roundedRectPath(
  p: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: CornerRadii,
): void {
  const [tl, tr, br, bl] = radii;
  const round = (r: Point) => r[0] > 0 && r[1] > 0;
  const HALF = Math.PI / 2;

  p.moveTo(x + (round(tl) ? tl[0] : 0), y);
  p.lineTo(x + w - (round(tr) ? tr[0] : 0), y);
  if (round(tr)) {
    p.ellipse(x + w - tr[0], y + tr[1], tr[0], tr[1], 0, -HALF, 0);
  }
  p.lineTo(x + w, y + h - (round(br) ? br[1] : 0));
  if (round(br)) {
    p.ellipse(x + w - br[0], y + h - br[1], br[0], br[1], 0, 0, HALF);
  }
  p.lineTo(x + (round(bl) ? bl[0] : 0), y + h);
  if (round(bl)) {
    p.ellipse(x + bl[0], y + h - bl[1], bl[0], bl[1], 0, HALF, Math.PI);
  }
  p.lineTo(x, y + (round(tl) ? tl[1] : 0));
  if (round(tl)) {
    p.ellipse(x + tl[0], y + tl[1], tl[0], tl[1], 0, Math.PI, 3 * HALF);
  }
  p.closePath();
}

function expandSides(values: string[]): [string, string, string, string] {
  const [a, b, c, d] = values;
  switch (values.length) {
    case 1:
      return [a!, a!, a!, a!];
    case 2:
      return [a!, b!, a!, b!];
    case 3:
      return [a!, b!, c!, b!];
    default:
      return [a!, b!, c!, d!];
  }
}

/** Split `... round <radii>` into the shape part and the optional radii part. */
function splitRound(args: string): [string, string | undefined] {
  const m = args.match(/^(.*?)\bround\b(.*)$/s);
  if (!m) return [args, undefined];
  return [m[1]!, m[2]!];
}

/** Split `<radius> at <position>` into the radius part and the position part. */
function splitAt(args: string): [string, string | undefined] {
  const m = args.match(/^(.*?)\bat\b(.*)$/s);
  if (!m) return [args, undefined];
  return [m[1]!, m[2]!];
}

/** Split on top-level commas, respecting parentheses and quoted strings. */
function splitArgs(content: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (const char of content) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function splitAtSlash(tokens: string[]): string[][] {
  if (tokens.length === 0) return [];
  const slash = tokens.indexOf("/");
  return slash === -1
    ? [tokens]
    : [tokens.slice(0, slash), tokens.slice(slash + 1)];
}

function tokenize(value: string): string[] {
  return value.trim().replace(/\//g, " / ").split(/\s+/).filter(Boolean);
}

function unquote(s: string): string {
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function parseAngleDegrees(value: string): number {
  const n = parseFloat(value);
  if (isNaN(n)) return NaN;
  if (value.endsWith("deg")) return n;
  if (value.endsWith("grad")) return n * 0.9;
  if (value.endsWith("rad")) return (n * 180) / Math.PI;
  if (value.endsWith("turn")) return n * 360;
  return n;
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function fmtPoint(p: Point): string {
  return `${fmt(p[0])} ${fmt(p[1])}`;
}
