import type { SKRSContext2D } from "@napi-rs/canvas";

import type { LayoutNode } from "../../layout.ts";
import type { SvgChild } from "./types.ts";
import { mergeStyleIntoProps, resolveInheritedStyle } from "./style.ts";
import { collectDefs } from "./defs.ts";
import { drawSvgChild } from "./traverse.ts";

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

  // Build inherited SVG style from the <svg> element
  const merged = mergeStyleIntoProps(node.props);
  const inherited = resolveInheritedStyle(merged, color);

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
      drawSvgChild(ctx, child, inherited, color, defs, vbW, vbH);
    }
  }

  ctx.restore();
}
