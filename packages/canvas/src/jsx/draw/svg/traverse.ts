import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";

import type { InheritedSvgStyle, SvgChild, SvgDefs } from "./types.ts";
import { EMPTY_DEFS } from "./defs.ts";
import { normalizeChildren } from "./tree.ts";
import {
  mergeStyleIntoProps,
  parseUrlRef,
  resolveInheritedStyle,
} from "./style.ts";
import { applyTransformAndOpacity } from "./transform.ts";
import { buildClipPath } from "./path.ts";
import { applyFilter } from "./filters.ts";
import { acquireOffscreen, releaseOffscreen } from "../offscreen.ts";
import {
  drawPath,
  drawCircle,
  drawSvgRect,
  drawLine,
  drawEllipse,
  drawPolygon,
  drawPolyline,
} from "./shapes.ts";

export function drawSvgChild(
  ctx: SKRSContext2D,
  child: SvgChild,
  inherited: InheritedSvgStyle,
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

  // Apply transform and opacity on shape elements (drawGroup handles its own)
  const transform =
    type !== "g" ? (props.transform as string | undefined) : undefined;
  const opacity = type !== "g" ? Number(props.opacity ?? 1) : 1;
  const savedTransform = applyTransformAndOpacity(ctx, transform, opacity);

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

  if (clipPath) {
    ctx.save();
    ctx.clip(clipPath);
  }

  // When a mask or filter is present, render the element to an offscreen
  // canvas so we can post-process it before drawing to the main context.
  const needsOffscreen = maskShapes || filterDef;
  let elemCanvas: Canvas | undefined;
  let targetCtx: SKRSContext2D;
  if (needsOffscreen) {
    const [c, cCtx] = acquireOffscreen(Math.ceil(vbW), Math.ceil(vbH));
    elemCanvas = c;
    targetCtx = cCtx;
  } else {
    targetCtx = ctx;
  }

  switch (type) {
    case "path":
      drawPath(targetCtx, props, inherited, color, defs);
      break;
    case "circle":
      drawCircle(targetCtx, props, inherited, color, defs, vbW, vbH);
      break;
    case "rect":
      drawSvgRect(targetCtx, props, inherited, color, defs, vbW, vbH);
      break;
    case "line":
      drawLine(targetCtx, props, inherited, color, defs, vbW, vbH);
      break;
    case "ellipse":
      drawEllipse(targetCtx, props, inherited, color, defs, vbW, vbH);
      break;
    case "polygon":
      drawPolygon(targetCtx, props, inherited, color, defs);
      break;
    case "polyline":
      drawPolyline(targetCtx, props, inherited, color, defs);
      break;
    case "g":
      drawGroup(targetCtx, child, props, inherited, color, defs, vbW, vbH);
      break;
  }

  if (needsOffscreen && elemCanvas) {
    applyOffscreenEffects(
      ctx,
      elemCanvas,
      targetCtx,
      maskShapes,
      filterDef,
      color,
      defs,
      vbW,
      vbH,
    );
  }

  if (clipPath) ctx.restore();
  if (savedTransform) ctx.restore();
}

function drawGroup(
  ctx: SKRSContext2D,
  node: SvgChild,
  mergedProps: Record<string, unknown>,
  inherited: InheritedSvgStyle,
  color: string,
  defs: SvgDefs = EMPTY_DEFS,
  vbW = 0,
  vbH = 0,
): void {
  const children = normalizeChildren(node);
  if (children.length === 0) return;
  const groupInherited = resolveInheritedStyle(mergedProps, color, inherited);

  const opacity = Number(mergedProps.opacity ?? 1);
  const transform = mergedProps.transform as string | undefined;
  const saved = applyTransformAndOpacity(ctx, transform, opacity);

  for (const child of children) {
    if (child != null && typeof child === "object") {
      drawSvgChild(ctx, child, groupInherited, color, defs, vbW, vbH);
    }
  }

  if (saved) ctx.restore();
}

/** Composite mask and/or filter effects from offscreen canvas onto main context. */
function applyOffscreenEffects(
  ctx: SKRSContext2D,
  elemCanvas: Canvas,
  targetCtx: SKRSContext2D,
  maskShapes: SvgChild[] | undefined,
  filterDef: SvgChild | undefined,
  color: string,
  defs: SvgDefs,
  vbW: number,
  vbH: number,
): void {
  // Apply mask if present
  if (maskShapes) {
    const [maskCanvas, maskCtx] = acquireOffscreen(
      Math.ceil(vbW),
      Math.ceil(vbH),
    );
    for (const shape of maskShapes) {
      drawSvgChild(maskCtx, shape, { fill: "white" }, "white", defs, vbW, vbH);
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
