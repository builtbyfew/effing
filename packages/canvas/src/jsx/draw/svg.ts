import { Path2D } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import type { LayoutNode } from "../layout.ts";

type SvgChild = {
  type: string;
  props: Record<string, unknown>;
  children?: SvgChild | SvgChild[];
};

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

  // Inherited fill from the <svg> element (SVG fill is inheritable)
  const inheritedFill = (node.props.fill as string | undefined) ?? "black";

  // Traverse React children
  const children = node.props.children;
  if (children != null) {
    const childArray = Array.isArray(children) ? children : [children];
    for (const child of childArray) {
      if (child != null && typeof child === "object") {
        drawSvgChild(ctx, child as SvgChild, inheritedFill);
      }
    }
  }

  ctx.restore();
}

function drawSvgChild(
  ctx: SKRSContext2D,
  child: SvgChild,
  inheritedFill: string,
): void {
  const { type, props } = child;

  switch (type) {
    case "path":
      drawPath(ctx, props, inheritedFill);
      break;
    case "circle":
      drawCircle(ctx, props, inheritedFill);
      break;
    case "rect":
      drawSvgRect(ctx, props, inheritedFill);
      break;
    case "line":
      drawLine(ctx, props);
      break;
    case "ellipse":
      drawEllipse(ctx, props, inheritedFill);
      break;
    case "polygon":
      drawPolygon(ctx, props, inheritedFill);
      break;
    case "polyline":
      drawPolyline(ctx, props, inheritedFill);
      break;
    case "g":
      drawGroup(ctx, child, inheritedFill);
      break;
  }
}

function drawPath(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
): void {
  const d = props.d as string | undefined;
  if (!d) return;

  const path = new Path2D(d);
  applyFillAndStroke(ctx, props, path, inheritedFill);
}

function drawCircle(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
): void {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const r = Number(props.r ?? 0);
  if (r <= 0) return;

  const path = new Path2D();
  path.arc(cx, cy, r, 0, Math.PI * 2);
  applyFillAndStroke(ctx, props, path, inheritedFill);
}

function drawSvgRect(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
): void {
  const rx = Number(props.x ?? 0);
  const ry = Number(props.y ?? 0);
  const w = Number(props.width ?? 0);
  const h = Number(props.height ?? 0);
  if (w <= 0 || h <= 0) return;

  const path = new Path2D();
  path.rect(rx, ry, w, h);
  applyFillAndStroke(ctx, props, path, inheritedFill);
}

function drawLine(ctx: SKRSContext2D, props: Record<string, unknown>): void {
  const x1 = Number(props.x1 ?? 0);
  const y1 = Number(props.y1 ?? 0);
  const x2 = Number(props.x2 ?? 0);
  const y2 = Number(props.y2 ?? 0);

  const path = new Path2D();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  // Lines are stroke-only
  applyStroke(ctx, props, path);
}

function drawEllipse(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
): void {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const rx = Number(props.rx ?? 0);
  const ry = Number(props.ry ?? 0);
  if (rx <= 0 || ry <= 0) return;

  const path = new Path2D();
  path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  applyFillAndStroke(ctx, props, path, inheritedFill);
}

function drawPolygon(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
): void {
  const points = parsePoints(props.points as string | undefined);
  if (points.length < 2) return;

  const path = new Path2D();
  path.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]![0], points[i]![1]);
  }
  path.closePath();
  applyFillAndStroke(ctx, props, path, inheritedFill);
}

function drawPolyline(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inheritedFill: string,
): void {
  const points = parsePoints(props.points as string | undefined);
  if (points.length < 2) return;

  const path = new Path2D();
  path.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    path.lineTo(points[i]![0], points[i]![1]);
  }
  applyFillAndStroke(ctx, props, path, inheritedFill);
}

function drawGroup(
  ctx: SKRSContext2D,
  node: SvgChild,
  inheritedFill: string,
): void {
  const children =
    node.children ?? (node.props.children as SvgChild | SvgChild[] | undefined);
  if (children == null) return;
  // Group can override inherited fill
  const groupFill = (node.props.fill as string | undefined) ?? inheritedFill;
  const childArray = Array.isArray(children) ? children : [children];
  for (const child of childArray) {
    if (child != null && typeof child === "object") {
      drawSvgChild(ctx, child, groupFill);
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
): void {
  // Use element's own fill if set, otherwise inherit from parent
  const fill = (props.fill as string | undefined) ?? inheritedFill;
  if (fill !== "none") {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }

  applyStroke(ctx, props, path);
}

function applyStroke(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  path: Path2D,
): void {
  const stroke = props.stroke as string | undefined;
  if (!stroke || stroke === "none") return;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = Number(props.strokeWidth ?? 1);
  ctx.lineCap = (props.strokeLinecap as CanvasLineCap) ?? "butt";
  ctx.lineJoin = (props.strokeLinejoin as CanvasLineJoin) ?? "miter";
  ctx.stroke(path);
}
