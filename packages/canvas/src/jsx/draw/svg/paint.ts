import type { Path2D, SKRSContext2D } from "@napi-rs/canvas";

import type { BBox, InheritedSvgStyle, SvgDefs } from "./types.ts";
import { resolveCurrentColor } from "./style.ts";
import { parseUrlRef } from "./style.ts";
import {
  applyOpacity,
  fillWithSvgGradient,
  strokeWithSvgGradient,
} from "./gradients.ts";

export function applyFillAndStroke(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  path: Path2D,
  inherited: InheritedSvgStyle,
  color: string,
  defs: SvgDefs,
  bbox: BBox,
): void {
  // Use element's own fill if set, otherwise inherit from parent
  const fill =
    resolveCurrentColor(props.fill as string | undefined, color) ??
    inherited.fill;
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

  applyStroke(ctx, props, path, inherited, color, defs, bbox);
}

export function applyStroke(
  ctx: SKRSContext2D,
  props: Record<string, unknown>,
  path: Path2D,
  inherited: InheritedSvgStyle,
  color: string,
  defs: SvgDefs,
  bbox: BBox,
): void {
  const stroke =
    resolveCurrentColor(props.stroke as string | undefined, color) ??
    inherited.stroke;
  if (!stroke || stroke === "none") return;

  const strokeOpacity = Number(
    props.strokeOpacity ??
      props["stroke-opacity"] ??
      inherited.strokeOpacity ??
      1,
  );

  ctx.lineWidth = Number(
    props.strokeWidth ?? props["stroke-width"] ?? inherited.strokeWidth ?? 1,
  );
  ctx.lineCap = (((props.strokeLinecap ??
    props["stroke-linecap"]) as CanvasLineCap) ??
    inherited.strokeLinecap ??
    "butt") as CanvasLineCap;
  ctx.lineJoin = (((props.strokeLinejoin ??
    props["stroke-linejoin"]) as CanvasLineJoin) ??
    inherited.strokeLinejoin ??
    "miter") as CanvasLineJoin;

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
