import { Path2D } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import type { LayoutNode } from "../layout.ts";

type SvgChild = {
  type: string;
  props: Record<string, unknown>;
  children?: SvgChild | SvgChild[];
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

/** Map of clipPath id → child shapes */
type DefsMap = Map<string, SvgChild[]>;

/**
 * Collect `<clipPath>` definitions from `<defs>` elements.
 */
function collectDefs(children: SvgChild[]): DefsMap {
  const defs: DefsMap = new Map();
  for (const child of children) {
    if (child.type !== "defs") continue;
    const defsChildren = normalizeChildren(child);
    for (const def of defsChildren) {
      if (def.type === "clipPath") {
        const id = def.props.id as string | undefined;
        if (id) {
          defs.set(id, normalizeChildren(def));
        }
      }
    }
  }
  return defs;
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

    // First pass: collect <clipPath> definitions from <defs>
    const defs = collectDefs(svgChildren);

    // Second pass: draw children
    for (const child of svgChildren) {
      drawSvgChild(ctx, child, inheritedFill, color, defs);
    }
  }

  ctx.restore();
}

function drawSvgChild(
  ctx: SKRSContext2D,
  child: SvgChild,
  inheritedFill: string,
  color: string,
  defs: DefsMap = new Map(),
): void {
  const { type } = child;
  const props = mergeStyleIntoProps(child.props);

  // Skip non-drawable definition elements
  if (type === "defs" || type === "clipPath") return;

  // Check for clip-path="url(#id)" reference
  const clipRef = parseUrlRef(props.clipPath ?? props["clip-path"]);
  const clipShapes = clipRef ? defs.get(clipRef) : undefined;
  const clipPath = clipShapes ? buildClipPath(clipShapes) : undefined;

  if (clipPath) ctx.save();
  if (clipPath) ctx.clip(clipPath);

  switch (type) {
    case "path":
      drawPath(ctx, props, inheritedFill, color);
      break;
    case "circle":
      drawCircle(ctx, props, inheritedFill, color);
      break;
    case "rect":
      drawSvgRect(ctx, props, inheritedFill, color);
      break;
    case "line":
      drawLine(ctx, props, color);
      break;
    case "ellipse":
      drawEllipse(ctx, props, inheritedFill, color);
      break;
    case "polygon":
      drawPolygon(ctx, props, inheritedFill, color);
      break;
    case "polyline":
      drawPolyline(ctx, props, inheritedFill, color);
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
): void {
  const d = props.d as string | undefined;
  if (!d) return;

  const path = new Path2D(d);
  applyFillAndStroke(ctx, props, path, inheritedFill, color);
}

function drawCircle(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
): void {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const r = Number(props.r ?? 0);
  if (r <= 0) return;

  const path = new Path2D();
  path.arc(cx, cy, r, 0, Math.PI * 2);
  applyFillAndStroke(ctx, props, path, inheritedFill, color);
}

function drawSvgRect(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
): void {
  const rx = Number(props.x ?? 0);
  const ry = Number(props.y ?? 0);
  const w = Number(props.width ?? 0);
  const h = Number(props.height ?? 0);
  if (w <= 0 || h <= 0) return;

  const path = new Path2D();
  path.rect(rx, ry, w, h);
  applyFillAndStroke(ctx, props, path, inheritedFill, color);
}

function drawLine(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  color: string,
): void {
  const x1 = Number(props.x1 ?? 0);
  const y1 = Number(props.y1 ?? 0);
  const x2 = Number(props.x2 ?? 0);
  const y2 = Number(props.y2 ?? 0);

  const path = new Path2D();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  // Lines are stroke-only
  applyStroke(ctx, props, path, color);
}

function drawEllipse(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
): void {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const rx = Number(props.rx ?? 0);
  const ry = Number(props.ry ?? 0);
  if (rx <= 0 || ry <= 0) return;

  const path = new Path2D();
  path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  applyFillAndStroke(ctx, props, path, inheritedFill, color);
}

function drawPolygon(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
): void {
  const points = parsePoints(props.points as string | undefined);
  if (points.length < 2) return;

  const path = new Path2D();
  path.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]![0], points[i]![1]);
  }
  path.closePath();
  applyFillAndStroke(ctx, props, path, inheritedFill, color);
}

function drawPolyline(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
  color: string,
): void {
  const points = parsePoints(props.points as string | undefined);
  if (points.length < 2) return;

  const path = new Path2D();
  path.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]![0], points[i]![1]);
  }
  applyFillAndStroke(ctx, props, path, inheritedFill, color);
}

function drawGroup(
  ctx: SKRSContext2D,
  node: SvgChild,
  inheritedFill: string,
  color: string,
  defs: DefsMap = new Map(),
): void {
  const children = normalizeChildren(node);
  if (children.length === 0) return;
  // Group can override inherited fill
  const merged = mergeStyleIntoProps(node.props);
  const groupFill =
    resolveCurrentColor(merged.fill as string | undefined, color) ??
    inheritedFill;
  for (const child of children) {
    if (child != null && typeof child === "object") {
      drawSvgChild(ctx, child, groupFill, color, defs);
    }
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

  if (fill !== "none") {
    ctx.fillStyle = fill;
    ctx.fill(path, fillRule ?? "nonzero");
  }

  applyStroke(ctx, props, path, color);
}

function applyStroke(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  path: Path2D,
  color: string,
): void {
  const stroke = resolveCurrentColor(props.stroke as string | undefined, color);
  if (!stroke || stroke === "none") return;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = Number(props.strokeWidth ?? props["stroke-width"] ?? 1);
  ctx.lineCap =
    ((props.strokeLinecap ?? props["stroke-linecap"]) as CanvasLineCap) ??
    "butt";
  ctx.lineJoin =
    ((props.strokeLinejoin ?? props["stroke-linejoin"]) as CanvasLineJoin) ??
    "miter";
  ctx.stroke(path);
}
