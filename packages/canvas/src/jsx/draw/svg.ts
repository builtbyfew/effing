import { Path2D } from "@napi-rs/canvas";
import type {
  CanvasGradient,
  DOMMatrix2DInit,
  SKRSContext2D,
} from "@napi-rs/canvas";

import type { LayoutNode } from "../layout.ts";

type SvgChild = {
  type: string;
  props: Record<string, unknown>;
  children?: SvgChild | SvgChild[];
};

type BBox = { x: number; y: number; width: number; height: number };

/** Collected `<defs>` definitions: clip paths and gradients. */
type SvgDefs = {
  clips: Map<string, SvgChild[]>;
  gradients: Map<string, SvgChild>;
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
 * Collect `<clipPath>` and gradient definitions from `<defs>` elements.
 */
function collectDefs(children: SvgChild[]): SvgDefs {
  const clips = new Map<string, SvgChild[]>();
  const gradients = new Map<string, SvgChild>();
  for (const child of children) {
    if (child.type !== "defs") continue;
    for (const def of normalizeChildren(child)) {
      const id = def.props.id as string | undefined;
      if (!id) continue;
      if (def.type === "clipPath") clips.set(id, normalizeChildren(def));
      else if (def.type === "radialGradient" || def.type === "linearGradient")
        gradients.set(id, def);
    }
  }
  return { clips, gradients };
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
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m)
    return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${opacity})`;
  return color;
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
function buildPath(child: SvgChild): Path2D | undefined {
  const props = mergeStyleIntoProps(child.props);
  switch (child.type) {
    case "path": {
      const d = props.d as string | undefined;
      if (!d) return undefined;
      return new Path2D(d);
    }
    case "circle": {
      const cx = Number(props.cx ?? 0);
      const cy = Number(props.cy ?? 0);
      const r = Number(props.r ?? 0);
      if (r <= 0) return undefined;
      const p = new Path2D();
      p.arc(cx, cy, r, 0, Math.PI * 2);
      return p;
    }
    case "rect": {
      const rx = Number(props.x ?? 0);
      const ry = Number(props.y ?? 0);
      const w = Number(props.width ?? 0);
      const h = Number(props.height ?? 0);
      if (w <= 0 || h <= 0) return undefined;
      const p = new Path2D();
      p.rect(rx, ry, w, h);
      return p;
    }
    case "ellipse": {
      const cx = Number(props.cx ?? 0);
      const cy = Number(props.cy ?? 0);
      const rx = Number(props.rx ?? 0);
      const ry = Number(props.ry ?? 0);
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
function buildClipPath(shapes: SvgChild[]): Path2D | undefined {
  let combined: Path2D | undefined;
  for (const shape of shapes) {
    const p = buildPath(shape);
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

  // Parse viewBox for coordinate mapping
  const viewBox = node.props.viewBox as string | undefined;
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      const [vbX, vbY, vbW, vbH] = parts as [number, number, number, number];
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
      drawSvgChild(ctx, child, inheritedFill, color, defs);
    }
  }

  ctx.restore();
}

const EMPTY_DEFS: SvgDefs = {
  clips: new Map(),
  gradients: new Map(),
};

function drawSvgChild(
  ctx: SKRSContext2D,
  child: SvgChild,
  inheritedFill: string,
  color: string,
  defs: SvgDefs = EMPTY_DEFS,
): void {
  const { type } = child;
  const props = mergeStyleIntoProps(child.props);

  // Skip non-drawable definition elements
  if (type === "defs" || type === "clipPath") return;

  // Check for clip-path="url(#id)" reference
  const clipRef = parseUrlRef(props.clipPath ?? props["clip-path"]);
  const clipShapes = clipRef ? defs.clips.get(clipRef) : undefined;
  const clipPath = clipShapes ? buildClipPath(clipShapes) : undefined;

  if (clipPath) ctx.save();
  if (clipPath) ctx.clip(clipPath);

  switch (type) {
    case "path":
      drawPath(ctx, props, inheritedFill, color, defs);
      break;
    case "circle":
      drawCircle(ctx, props, inheritedFill, color, defs);
      break;
    case "rect":
      drawSvgRect(ctx, props, inheritedFill, color, defs);
      break;
    case "line":
      drawLine(ctx, props, color, defs);
      break;
    case "ellipse":
      drawEllipse(ctx, props, inheritedFill, color, defs);
      break;
    case "polygon":
      drawPolygon(ctx, props, inheritedFill, color, defs);
      break;
    case "polyline":
      drawPolyline(ctx, props, inheritedFill, color, defs);
      break;
    case "g":
      drawGroup(ctx, child, inheritedFill, color, defs);
      break;
  }

  if (clipPath) ctx.restore();
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
): void {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const r = Number(props.r ?? 0);
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
): void {
  const rx = Number(props.x ?? 0);
  const ry = Number(props.y ?? 0);
  const w = Number(props.width ?? 0);
  const h = Number(props.height ?? 0);
  if (w <= 0 || h <= 0) return;

  const path = new Path2D();
  path.rect(rx, ry, w, h);
  const bbox: BBox = { x: rx, y: ry, width: w, height: h };
  applyFillAndStroke(ctx, props, path, inheritedFill, color, defs, bbox);
}

function drawLine(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  color: string,
  defs: SvgDefs,
): void {
  const x1 = Number(props.x1 ?? 0);
  const y1 = Number(props.y1 ?? 0);
  const x2 = Number(props.x2 ?? 0);
  const y2 = Number(props.y2 ?? 0);

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
): void {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const rx = Number(props.rx ?? 0);
  const ry = Number(props.ry ?? 0);
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
      drawSvgChild(ctx, child, groupFill, color, defs);
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
  const clipRule = (props.clipRule ?? props["clip-rule"]) as
    | CanvasFillRule
    | undefined;

  if (clipRule) {
    ctx.clip(path, clipRule);
  }

  // Resolve url(#id) gradient reference
  const fillRef = parseUrlRef(fill);
  if (fillRef) {
    const gradientDef = defs.gradients.get(fillRef);
    if (gradientDef) {
      fillWithSvgGradient(ctx, gradientDef, bbox, path, fillRule ?? "nonzero");
    }
  } else if (fill !== "none") {
    ctx.fillStyle = fill;
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
      strokeWithSvgGradient(ctx, gradientDef, bbox, path);
      return;
    }
  }

  ctx.strokeStyle = stroke;
  ctx.stroke(path);
}
