import { Path2D } from "@napi-rs/canvas";
import type {
  CanvasGradient,
  DOMMatrix2DInit,
  SKRSContext2D,
} from "@napi-rs/canvas";

import parseCssColor from "parse-css-color";

import type { LayoutNode } from "../layout.ts";
import { acquireOffscreen, releaseOffscreen } from "./offscreen.ts";

type SvgChild = {
  type: string;
  props: Record<string, unknown>;
  children?: SvgChild | SvgChild[];
};

type BBox = { x: number; y: number; width: number; height: number };

/** Collected `<defs>` definitions: clip paths, gradients, masks, and filters. */
type SvgDefs = {
  clips: Map<string, SvgChild[]>;
  gradients: Map<string, SvgChild>;
  masks: Map<string, SvgChild[]>;
  filters: Map<string, SvgChild>;
};

/** Replace `"currentColor"` with the inherited CSS `color` value. */
function resolveCurrentColor(
  value: string | undefined,
  color: string,
): string | undefined {
  if (value?.toLowerCase() === "currentcolor") return color;
  return value;
}

/**
 * Merge SVG presentation properties from `props.style` into the props object.
 * Style values win over direct props, matching browser CSS specificity rules.
 */
function mergeStyleIntoProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const style = props.style as Record<string, unknown> | undefined;
  if (!style) return props;
  return { ...props, ...style };
}

/**
 * Collect `<clipPath>`, `<mask>`, `<filter>`, and gradient definitions from
 * `<defs>` elements as well as direct children of `<svg>` (both are valid per
 * the SVG spec).
 */
function collectDefs(children: SvgChild[]): SvgDefs {
  const clips = new Map<string, SvgChild[]>();
  const gradients = new Map<string, SvgChild>();
  const masks = new Map<string, SvgChild[]>();
  const filters = new Map<string, SvgChild>();

  function insertDef(def: SvgChild): void {
    const id = def.props.id as string | undefined;
    if (!id) return;
    if (def.type === "clipPath") clips.set(id, normalizeChildren(def));
    else if (def.type === "mask") masks.set(id, normalizeChildren(def));
    else if (def.type === "filter") filters.set(id, def);
    else if (def.type === "radialGradient" || def.type === "linearGradient")
      gradients.set(id, def);
  }

  for (const child of children) {
    if (child.type === "defs") {
      for (const def of normalizeChildren(child)) insertDef(def);
    } else {
      // Definition elements can appear as direct children of <svg>.
      insertDef(child);
    }
  }
  return { clips, gradients, masks, filters };
}

/** Parse `url(#id)` references and return the id, or undefined. */
function parseUrlRef(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = value.match(/^url\(#(.+)\)$/);
  return m?.[1];
}

/** Normalize children from either `.children` or `.props.children` into an array. */
function normalizeChildren(node: SvgChild): SvgChild[] {
  const raw =
    node.children ?? (node.props.children as SvgChild | SvgChild[] | undefined);
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ---------------------------------------------------------------------------
// Gradient helpers
// ---------------------------------------------------------------------------

/**
 * Parse an SVG length value, resolving percentages against a reference dimension.
 * Unlike `parseFrac`, this returns absolute coordinates (not 0–1 fractions).
 */
function svgLength(value: unknown, reference: number, fallback = 0): number {
  if (value == null) return fallback;
  const s = String(value);
  if (s.endsWith("%")) return (parseFloat(s) / 100) * reference;
  const n = Number(s);
  return isNaN(n) ? fallback : n;
}

/** Parse a gradient coordinate percentage/fraction to a 0–1 value. */
function parseFrac(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const s = String(value);
  if (s.endsWith("%")) return parseFloat(s) / 100;
  return Number(s);
}

/** Apply opacity to a CSS color string. */
function applyOpacity(color: string, opacity: number): string {
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

/**
 * Fill `path` with a gradient defined by `def` in the coordinate space of `bbox`.
 *
 * For `<linearGradient>` the bbox-to-canvas mapping is straightforward.
 * For `<radialGradient>` the SVG default `objectBoundingBox` produces an
 * *elliptical* gradient when the bbox is non-square.  Canvas only supports
 * circular radial gradients, so we apply a non-uniform scale transform to
 * the context and fill an inverse-transformed copy of the path.
 */
function fillWithSvgGradient(
  ctx: SKRSContext2D,
  def: SvgChild,
  bbox: BBox,
  path: Path2D,
  fillRule: CanvasFillRule,
): boolean {
  const props = def.props;

  if (def.type === "linearGradient") {
    const x1 = bbox.x + parseFrac(props.x1, 0) * bbox.width;
    const y1 = bbox.y + parseFrac(props.y1, 0) * bbox.height;
    const x2 = bbox.x + parseFrac(props.x2, 1) * bbox.width;
    const y2 = bbox.y + parseFrac(props.y2, 0) * bbox.height;
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    addGradientStops(gradient, def);
    ctx.fillStyle = gradient;
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
function strokeWithSvgGradient(
  ctx: SKRSContext2D,
  def: SvgChild,
  bbox: BBox,
  path: Path2D,
): boolean {
  const props = def.props;

  if (def.type === "linearGradient") {
    const x1 = bbox.x + parseFrac(props.x1, 0) * bbox.width;
    const y1 = bbox.y + parseFrac(props.y1, 0) * bbox.height;
    const x2 = bbox.x + parseFrac(props.x2, 1) * bbox.width;
    const y2 = bbox.y + parseFrac(props.y2, 0) * bbox.height;
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    addGradientStops(gradient, def);
    ctx.strokeStyle = gradient;
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

// ---------------------------------------------------------------------------
// Bounding-box helpers
// ---------------------------------------------------------------------------

/** Compute a conservative bounding box from SVG path data. */
function pathBBox(d: string): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;

  const update = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // Tokenize: commands and numbers (including negative)
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return { x: 0, y: 0, width: 0, height: 0 };

  let cmd = "";
  let i = 0;
  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    }

    switch (cmd) {
      case "M":
        cx = num();
        cy = num();
        update(cx, cy);
        cmd = "L"; // implicit lineTo after moveTo
        break;
      case "m":
        cx += num();
        cy += num();
        update(cx, cy);
        cmd = "l";
        break;
      case "L":
        cx = num();
        cy = num();
        update(cx, cy);
        break;
      case "l":
        cx += num();
        cy += num();
        update(cx, cy);
        break;
      case "H":
        cx = num();
        update(cx, cy);
        break;
      case "h":
        cx += num();
        update(cx, cy);
        break;
      case "V":
        cy = num();
        update(cx, cy);
        break;
      case "v":
        cy += num();
        update(cx, cy);
        break;
      case "C": {
        // Cubic bezier: use control points as conservative bounds
        for (let j = 0; j < 3; j++) {
          const px = num();
          const py = num();
          update(px, py);
        }
        cx = Number(tokens[i - 2]);
        cy = Number(tokens[i - 1]);
        break;
      }
      case "c": {
        for (let j = 0; j < 3; j++) {
          const dx = num();
          const dy = num();
          update(cx + dx, cy + dy);
          if (j === 2) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }
      case "Q": {
        for (let j = 0; j < 2; j++) {
          const px = num();
          const py = num();
          update(px, py);
        }
        cx = Number(tokens[i - 2]);
        cy = Number(tokens[i - 1]);
        break;
      }
      case "q": {
        for (let j = 0; j < 2; j++) {
          const dx = num();
          const dy = num();
          update(cx + dx, cy + dy);
          if (j === 1) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }
      case "A": {
        // Arc: skip rx, ry, rotation, flags; endpoint is the bound
        num();
        num();
        num();
        num();
        num(); // rx ry rot largeArc sweep
        cx = num();
        cy = num();
        update(cx, cy);
        break;
      }
      case "a": {
        num();
        num();
        num();
        num();
        num();
        cx += num();
        cy += num();
        update(cx, cy);
        break;
      }
      case "Z":
      case "z":
        break;
      default:
        // Unknown command — skip token to avoid infinite loop
        i++;
        break;
    }
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Compute bounding box from a points attribute (polygon/polyline). */
function pointsBBox(points: [number, number][]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Build a `Path2D` from an SVG shape element (without drawing it).
 * Returns `undefined` for unsupported element types.
 */
function buildPath(
  child: SvgChild,
  vbW: number,
  vbH: number,
): Path2D | undefined {
  const props = mergeStyleIntoProps(child.props);
  switch (child.type) {
    case "path": {
      const d = props.d as string | undefined;
      if (!d) return undefined;
      return new Path2D(d);
    }
    case "circle": {
      const cx = svgLength(props.cx, vbW);
      const cy = svgLength(props.cy, vbH);
      const r = svgLength(props.r, Math.min(vbW, vbH));
      if (r <= 0) return undefined;
      const p = new Path2D();
      p.arc(cx, cy, r, 0, Math.PI * 2);
      return p;
    }
    case "rect": {
      const x = svgLength(props.x, vbW);
      const y = svgLength(props.y, vbH);
      const w = svgLength(props.width, vbW);
      const h = svgLength(props.height, vbH);
      if (w <= 0 || h <= 0) return undefined;
      const rxRaw = svgLength(props.rx, vbW, -1);
      const ryRaw = svgLength(props.ry, vbH, -1);
      let rx = rxRaw >= 0 ? rxRaw : ryRaw >= 0 ? ryRaw : 0;
      let ry = ryRaw >= 0 ? ryRaw : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      const p = new Path2D();
      if (rx > 0 || ry > 0) {
        p.roundRect(x, y, w, h, [rx]);
      } else {
        p.rect(x, y, w, h);
      }
      return p;
    }
    case "ellipse": {
      const cx = svgLength(props.cx, vbW);
      const cy = svgLength(props.cy, vbH);
      const rx = svgLength(props.rx, vbW);
      const ry = svgLength(props.ry, vbH);
      if (rx <= 0 || ry <= 0) return undefined;
      const p = new Path2D();
      p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      return p;
    }
    case "polygon": {
      const points = parsePoints(props.points as string | undefined);
      if (points.length < 2) return undefined;
      const p = new Path2D();
      p.moveTo(points[0]![0], points[0]![1]);
      for (let i = 1; i < points.length; i++) {
        p.lineTo(points[i]![0], points[i]![1]);
      }
      p.closePath();
      return p;
    }
    default:
      return undefined;
  }
}

/**
 * Build a combined `Path2D` from all children of a `<clipPath>` definition.
 */
function buildClipPath(
  shapes: SvgChild[],
  vbW: number,
  vbH: number,
): Path2D | undefined {
  let combined: Path2D | undefined;
  for (const shape of shapes) {
    const p = buildPath(shape, vbW, vbH);
    if (!p) continue;
    if (!combined) {
      combined = p;
    } else {
      combined.addPath(p);
    }
  }
  return combined;
}

/**
 * Draw an `<svg>` container and its SVG children (path, circle, rect, etc.).
 *
 * Parses the `viewBox` prop to compute scale factors, then recurses into
 * the React children stored in `node.props.children`.
 */
export function drawSvgContainer(
  ctx: SKRSContext2D,
  node: LayoutNode,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.translate(x, y);

  // Parse viewBox for coordinate mapping; default to rendered size when absent
  const viewBox = node.props.viewBox as string | undefined;
  let vbW = width;
  let vbH = height;
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      const [vbX, vbY, parsedW, parsedH] = parts as [
        number,
        number,
        number,
        number,
      ];
      vbW = parsedW;
      vbH = parsedH;
      const scaleX = width / vbW;
      const scaleY = height / vbH;
      ctx.scale(scaleX, scaleY);
      ctx.translate(-vbX, -vbY);
    }
  }

  // Resolve the CSS `color` property for `currentColor` references
  const color = (node.style.color as string | undefined) ?? "black";

  // Inherited fill from the <svg> element (SVG fill is inheritable)
  const merged = mergeStyleIntoProps(node.props);
  const inheritedFill =
    resolveCurrentColor(merged.fill as string | undefined, color) ?? "black";

  // Traverse React children
  const children = node.props.children;
  if (children != null) {
    const childArray = Array.isArray(children) ? children : [children];
    const svgChildren = childArray.filter(
      (c): c is SvgChild => c != null && typeof c === "object",
    );

    // First pass: collect definitions from <defs>
    const defs = collectDefs(svgChildren);

    // Second pass: draw children
    for (const child of svgChildren) {
      drawSvgChild(ctx, child, inheritedFill, color, defs, vbW, vbH);
    }
  }

  ctx.restore();
}

const EMPTY_DEFS: SvgDefs = {
  clips: new Map(),
  gradients: new Map(),
  masks: new Map(),
  filters: new Map(),
};

// ---------------------------------------------------------------------------
// SVG filter primitives
// ---------------------------------------------------------------------------

function applyFeOffset(
  input: import("@napi-rs/canvas").Canvas,
  dx: number,
  dy: number,
  w: number,
  h: number,
): import("@napi-rs/canvas").Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.drawImage(input, dx, dy);
  return canvas;
}

function applyFeGaussianBlur(
  input: import("@napi-rs/canvas").Canvas,
  stdDeviation: number,
  w: number,
  h: number,
): import("@napi-rs/canvas").Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.filter = `blur(${stdDeviation}px)`;
  ctx.drawImage(input, 0, 0);
  ctx.filter = "none";
  return canvas;
}

function applyFeColorMatrix(
  input: import("@napi-rs/canvas").Canvas,
  type: string,
  values: string | undefined,
  w: number,
  h: number,
): import("@napi-rs/canvas").Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.drawImage(input, 0, 0);

  if (type === "matrix" && values) {
    const m = values
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (m.length >= 20) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const a = d[i + 3]!;
        d[i] = Math.min(
          255,
          Math.max(
            0,
            m[0]! * r + m[1]! * g + m[2]! * b + m[3]! * a + m[4]! * 255,
          ),
        );
        d[i + 1] = Math.min(
          255,
          Math.max(
            0,
            m[5]! * r + m[6]! * g + m[7]! * b + m[8]! * a + m[9]! * 255,
          ),
        );
        d[i + 2] = Math.min(
          255,
          Math.max(
            0,
            m[10]! * r + m[11]! * g + m[12]! * b + m[13]! * a + m[14]! * 255,
          ),
        );
        d[i + 3] = Math.min(
          255,
          Math.max(
            0,
            m[15]! * r + m[16]! * g + m[17]! * b + m[18]! * a + m[19]! * 255,
          ),
        );
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  return canvas;
}

function applyFeBlend(
  in1: import("@napi-rs/canvas").Canvas,
  in2: import("@napi-rs/canvas").Canvas,
  mode: string,
  w: number,
  h: number,
): import("@napi-rs/canvas").Canvas {
  const modeMap: Record<string, GlobalCompositeOperation> = {
    normal: "source-over",
    multiply: "multiply",
    screen: "screen",
    darken: "darken",
    lighten: "lighten",
    overlay: "overlay",
  };
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.drawImage(in2, 0, 0);
  ctx.globalCompositeOperation = modeMap[mode] ?? "source-over";
  ctx.drawImage(in1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/**
 * Extract the alpha channel of a canvas as a new greyscale canvas.
 * The result is a canvas where each pixel's RGBA channels equal the
 * source alpha (i.e. white where opaque, black where transparent).
 */
function extractSourceAlpha(
  input: import("@napi-rs/canvas").Canvas,
  w: number,
  h: number,
): import("@napi-rs/canvas").Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(input, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/**
 * Execute an SVG `<filter>` pipeline on the element canvas.
 * Returns a new canvas with the filtered result; the caller is responsible
 * for releasing all canvases.
 */
function applyFilter(
  filterDef: SvgChild,
  sourceGraphic: import("@napi-rs/canvas").Canvas,
  w: number,
  h: number,
): import("@napi-rs/canvas").Canvas {
  const buffers = new Map<string, import("@napi-rs/canvas").Canvas>();
  buffers.set("SourceGraphic", sourceGraphic);

  let sourceAlpha: import("@napi-rs/canvas").Canvas | undefined;
  const getSourceAlpha = () => {
    if (!sourceAlpha) {
      sourceAlpha = extractSourceAlpha(sourceGraphic, w, h);
      buffers.set("SourceAlpha", sourceAlpha);
    }
    return sourceAlpha;
  };

  const children = normalizeChildren(filterDef);
  let lastResult: import("@napi-rs/canvas").Canvas = sourceGraphic;

  for (const prim of children) {
    const p = prim.props;
    const inName = (p.in as string | undefined) ?? "";
    const resolve = (name: string): import("@napi-rs/canvas").Canvas => {
      if (name === "SourceAlpha") return getSourceAlpha();
      return buffers.get(name) ?? lastResult;
    };
    const input = inName ? resolve(inName) : lastResult;
    let output: import("@napi-rs/canvas").Canvas;

    switch (prim.type) {
      case "feOffset":
        output = applyFeOffset(
          input,
          Number(p.dx ?? 0),
          Number(p.dy ?? 0),
          w,
          h,
        );
        break;
      case "feGaussianBlur": {
        const std = Number(p.stdDeviation ?? 0);
        output = std > 0 ? applyFeGaussianBlur(input, std, w, h) : input;
        break;
      }
      case "feColorMatrix":
        output = applyFeColorMatrix(
          input,
          (p.type as string) ?? "matrix",
          p.values as string | undefined,
          w,
          h,
        );
        break;
      case "feBlend": {
        const in2Name = (p.in2 as string | undefined) ?? "";
        const in2 = in2Name ? resolve(in2Name) : lastResult;
        output = applyFeBlend(input, in2, (p.mode as string) ?? "normal", w, h);
        break;
      }
      default:
        output = input;
        break;
    }

    const resultName = p.result as string | undefined;
    if (resultName) buffers.set(resultName, output);
    lastResult = output;
  }

  return lastResult;
}

function drawSvgChild(
  ctx: SKRSContext2D,
  child: SvgChild,
  inheritedFill: string,
  color: string,
  defs: SvgDefs = EMPTY_DEFS,
  vbW = 0,
  vbH = 0,
): void {
  const { type } = child;
  const props = mergeStyleIntoProps(child.props);

  // Skip non-drawable definition elements
  if (
    type === "defs" ||
    type === "clipPath" ||
    type === "mask" ||
    type === "filter"
  )
    return;

  // Apply transform on shape elements (drawGroup already handles <g> transforms)
  const transform =
    type !== "g" ? (props.transform as string | undefined) : undefined;
  if (transform) {
    ctx.save();
    applySvgTransform(ctx, transform);
  }

  // Check for clip-path="url(#id)" reference
  const clipRef = parseUrlRef(props.clipPath ?? props["clip-path"]);
  const clipShapes = clipRef ? defs.clips.get(clipRef) : undefined;
  const clipPath = clipShapes ? buildClipPath(clipShapes, vbW, vbH) : undefined;

  // Check for mask="url(#id)" reference
  const maskRef = parseUrlRef(props.mask as string | undefined);
  const maskShapes = maskRef ? defs.masks.get(maskRef) : undefined;

  // Check for filter="url(#id)" reference
  const filterRef = parseUrlRef(props.filter as string | undefined);
  const filterDef = filterRef ? defs.filters.get(filterRef) : undefined;

  if (clipPath) ctx.save();
  if (clipPath) ctx.clip(clipPath);

  // When a mask or filter is present, render the element to an offscreen
  // canvas so we can post-process it before drawing to the main context.
  const needsOffscreen = maskShapes || filterDef;
  let elemCanvas: import("@napi-rs/canvas").Canvas | undefined;
  const targetCtx = needsOffscreen
    ? (() => {
        const [c, cCtx] = acquireOffscreen(Math.ceil(vbW), Math.ceil(vbH));
        elemCanvas = c;
        return cCtx;
      })()
    : ctx;

  switch (type) {
    case "path":
      drawPath(targetCtx, props, inheritedFill, color, defs);
      break;
    case "circle":
      drawCircle(targetCtx, props, inheritedFill, color, defs, vbW, vbH);
      break;
    case "rect":
      drawSvgRect(targetCtx, props, inheritedFill, color, defs, vbW, vbH);
      break;
    case "line":
      drawLine(targetCtx, props, color, defs, vbW, vbH);
      break;
    case "ellipse":
      drawEllipse(targetCtx, props, inheritedFill, color, defs, vbW, vbH);
      break;
    case "polygon":
      drawPolygon(targetCtx, props, inheritedFill, color, defs);
      break;
    case "polyline":
      drawPolyline(targetCtx, props, inheritedFill, color, defs);
      break;
    case "g":
      drawGroup(targetCtx, child, inheritedFill, color, defs, vbW, vbH);
      break;
  }

  if (needsOffscreen && elemCanvas) {
    // Apply mask if present
    if (maskShapes) {
      const [maskCanvas, maskCtx] = acquireOffscreen(
        Math.ceil(vbW),
        Math.ceil(vbH),
      );
      for (const shape of maskShapes) {
        drawSvgChild(maskCtx, shape, "white", "white", defs, vbW, vbH);
      }
      targetCtx.globalCompositeOperation = "destination-in";
      targetCtx.drawImage(maskCanvas, 0, 0);
      targetCtx.globalCompositeOperation = "source-over";
      releaseOffscreen(maskCanvas);
    }

    // Apply filter if present
    if (filterDef) {
      const filteredCanvas = applyFilter(
        filterDef,
        elemCanvas,
        Math.ceil(vbW),
        Math.ceil(vbH),
      );
      ctx.drawImage(filteredCanvas, 0, 0);
      // Release intermediates (filteredCanvas may be elemCanvas if no-op)
      if (filteredCanvas !== elemCanvas) releaseOffscreen(filteredCanvas);
    } else {
      ctx.drawImage(elemCanvas, 0, 0);
    }
    releaseOffscreen(elemCanvas);
  }

  if (clipPath) ctx.restore();
  if (transform) ctx.restore();
}

function drawPath(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
): void {
  const d = props.d as string | undefined;
  if (!d) return;

  const path = new Path2D(d);
  const bbox = pathBBox(d);
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

function drawCircle(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
  vbW = 0,
  vbH = 0,
): void {
  const cx = svgLength(props.cx, vbW);
  const cy = svgLength(props.cy, vbH);
  const r = svgLength(props.r, Math.min(vbW, vbH));
  if (r <= 0) return;

  const path = new Path2D();
  path.arc(cx, cy, r, 0, Math.PI * 2);
  const bbox: BBox = { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r };
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

function drawSvgRect(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
  vbW = 0,
  vbH = 0,
): void {
  const x = svgLength(props.x, vbW);
  const y = svgLength(props.y, vbH);
  const w = svgLength(props.width, vbW);
  const h = svgLength(props.height, vbH);
  if (w <= 0 || h <= 0) return;

  const rxRaw = svgLength(props.rx, vbW, -1);
  const ryRaw = svgLength(props.ry, vbH, -1);
  let rx = rxRaw >= 0 ? rxRaw : ryRaw >= 0 ? ryRaw : 0;
  let ry = ryRaw >= 0 ? ryRaw : rx;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);

  const path = new Path2D();
  if (rx > 0 || ry > 0) {
    path.roundRect(x, y, w, h, [rx]);
  } else {
    path.rect(x, y, w, h);
  }
  const bbox: BBox = { x, y, width: w, height: h };
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

function drawLine(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  color: string,
  defs: SvgDefs,
  vbW = 0,
  vbH = 0,
): void {
  const x1 = svgLength(props.x1, vbW);
  const y1 = svgLength(props.y1, vbH);
  const x2 = svgLength(props.x2, vbW);
  const y2 = svgLength(props.y2, vbH);

  const path = new Path2D();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  // Lines are stroke-only
  const bbox: BBox = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
  applyStroke(ctx, props, path, color, defs, bbox);
}

function drawEllipse(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
  vbW = 0,
  vbH = 0,
): void {
  const cx = svgLength(props.cx, vbW);
  const cy = svgLength(props.cy, vbH);
  const rx = svgLength(props.rx, vbW);
  const ry = svgLength(props.ry, vbH);
  if (rx <= 0 || ry <= 0) return;

  const path = new Path2D();
  path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const bbox: BBox = {
    x: cx - rx,
    y: cy - ry,
    width: 2 * rx,
    height: 2 * ry,
  };
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

function drawPolygon(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
): void {
  const points = parsePoints(props.points as string | undefined);
  if (points.length < 2) return;

  const path = new Path2D();
  path.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]![0], points[i]![1]);
  }
  path.closePath();
  const bbox = pointsBBox(points);
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

function drawPolyline(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
): void {
  const points = parsePoints(props.points as string | undefined);
  if (points.length < 2) return;

  const path = new Path2D();
  path.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]![0], points[i]![1]);
  }
  const bbox = pointsBBox(points);
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

/**
 * Parse an SVG `transform` attribute and apply it to the canvas context.
 *
 * Supports: translate, scale, rotate, skewX, skewY, matrix.
 * Multiple transforms are applied left-to-right (same order as SVG spec).
 */
function applySvgTransform(ctx: SKRSContext2D, transform: string): void {
  const re = /\b(translate|scale|rotate|skewX|skewY|matrix)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(transform)) !== null) {
    const fn = match[1]!;
    const args = match[2]!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    switch (fn) {
      case "translate":
        ctx.translate(args[0] ?? 0, args[1] ?? 0);
        break;
      case "scale": {
        const sx = args[0] ?? 1;
        ctx.scale(sx, args[1] ?? sx);
        break;
      }
      case "rotate": {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        if (args.length >= 3) {
          const cx = args[1]!;
          const cy = args[2]!;
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.translate(-cx, -cy);
        } else {
          ctx.rotate(angle);
        }
        break;
      }
      case "skewX":
        ctx.transform(
          1,
          0,
          Math.tan(((args[0] ?? 0) * Math.PI) / 180),
          1,
          0,
          0,
        );
        break;
      case "skewY":
        ctx.transform(
          1,
          Math.tan(((args[0] ?? 0) * Math.PI) / 180),
          0,
          1,
          0,
          0,
        );
        break;
      case "matrix":
        ctx.transform(
          args[0] ?? 1,
          args[1] ?? 0,
          args[2] ?? 0,
          args[3] ?? 1,
          args[4] ?? 0,
          args[5] ?? 0,
        );
        break;
    }
  }
}

function drawGroup(
  ctx: SKRSContext2D,
  node: SvgChild,
  inheritedFill: string,
  color: string,
  defs: SvgDefs = EMPTY_DEFS,
  vbW = 0,
  vbH = 0,
): void {
  const children = normalizeChildren(node);
  if (children.length === 0) return;
  // Group can override inherited fill
  const merged = mergeStyleIntoProps(node.props);
  const groupFill =
    resolveCurrentColor(merged.fill as string | undefined, color) ??
    inheritedFill;

  const transform = merged.transform as string | undefined;
  if (transform) {
    ctx.save();
    applySvgTransform(ctx, transform);
  }

  for (const child of children) {
    if (child != null && typeof child === "object") {
      drawSvgChild(ctx, child, groupFill, color, defs, vbW, vbH);
    }
  }

  if (transform) {
    ctx.restore();
  }
}

function parsePoints(value: string | undefined): [number, number][] {
  if (!value) return [];
  const nums = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const result: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    result.push([nums[i]!, nums[i + 1]!]);
  }
  return result;
}

function applyFillAndStroke(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  path: Path2D,
  inheritedFill: string,
  color: string,
  defs: SvgDefs,
  bbox: BBox,
): void {
  // Use element's own fill if set, otherwise inherit from parent
  const fill =
    resolveCurrentColor(props.fill as string | undefined, color) ??
    inheritedFill;
  const fillRule = (props.fillRule ?? props["fill-rule"]) as
    | CanvasFillRule
    | undefined;
  const fillOpacity = Number(props.fillOpacity ?? props["fill-opacity"] ?? 1);

  // Resolve url(#id) gradient reference
  const fillRef = parseUrlRef(fill);
  if (fillRef) {
    const gradientDef = defs.gradients.get(fillRef);
    if (gradientDef) {
      if (fillOpacity < 1) {
        ctx.save();
        ctx.globalAlpha *= fillOpacity;
        fillWithSvgGradient(
          ctx,
          gradientDef,
          bbox,
          path,
          fillRule ?? "nonzero",
        );
        ctx.restore();
      } else {
        fillWithSvgGradient(
          ctx,
          gradientDef,
          bbox,
          path,
          fillRule ?? "nonzero",
        );
      }
    }
  } else if (fill !== "none") {
    ctx.fillStyle = applyOpacity(fill, fillOpacity);
    ctx.fill(path, fillRule ?? "nonzero");
  }

  applyStroke(ctx, props, path, color, defs, bbox);
}

function applyStroke(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  path: Path2D,
  color: string,
  defs: SvgDefs,
  bbox: BBox,
): void {
  const stroke = resolveCurrentColor(props.stroke as string | undefined, color);
  if (!stroke || stroke === "none") return;

  const strokeOpacity = Number(
    props.strokeOpacity ?? props["stroke-opacity"] ?? 1,
  );

  ctx.lineWidth = Number(props.strokeWidth ?? props["stroke-width"] ?? 1);
  ctx.lineCap =
    ((props.strokeLinecap ?? props["stroke-linecap"]) as CanvasLineCap) ??
    "butt";
  ctx.lineJoin =
    ((props.strokeLinejoin ?? props["stroke-linejoin"]) as CanvasLineJoin) ??
    "miter";

  // Resolve url(#id) gradient reference for stroke
  const strokeRef = parseUrlRef(stroke);
  if (strokeRef) {
    const gradientDef = defs.gradients.get(strokeRef);
    if (gradientDef) {
      if (strokeOpacity < 1) {
        ctx.save();
        ctx.globalAlpha *= strokeOpacity;
        strokeWithSvgGradient(ctx, gradientDef, bbox, path);
        ctx.restore();
      } else {
        strokeWithSvgGradient(ctx, gradientDef, bbox, path);
      }
      return;
    }
  }

  ctx.strokeStyle = applyOpacity(stroke, strokeOpacity);
  ctx.stroke(path);
}
