import { Path2D } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import type { BBox, InheritedSvgStyle, SvgDefs } from "./types.ts";
import { applyFillAndStroke, applyStroke } from "./paint.ts";
import { pathBBox, pointsBBox, parsePoints } from "./path.ts";
import { svgLength } from "./style.ts";

export function drawPath(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
  color: string,
  defs: SvgDefs,
): void {
  const d = props.d as string | undefined;
  if (!d) return;

  const path = new Path2D(d);
  const bbox = pathBBox(d);
  applyFillAndStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function drawCircle(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
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
  applyFillAndStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function drawSvgRect(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
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
  applyFillAndStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function drawLine(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
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
  applyStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function drawEllipse(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
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
  applyFillAndStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function drawPolygon(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
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
  applyFillAndStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function drawPolyline(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  inherited: InheritedSvgStyle,
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
  applyFillAndStroke(ctx, props, path, inherited, color, defs, bbox);
}
