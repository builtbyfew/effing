import type { SKRSContext2D } from "@effing/skia";

import type { EmojiStyle } from "../emoji.ts";
import { cachedLoadImage } from "../../image.ts";
import type { LayoutNode } from "../layout.ts";
import type { RenderContext } from "../context.ts";
import { layoutText } from "../text/index.ts";
import type { TextLayoutResult } from "../text/index.ts";
import { applyClip, hasRadius, roundedRect } from "./clip.ts";
import { applyClipPath } from "./clip-path.ts";
import { createGradientFromCSS, splitGradientArgs } from "./gradient.ts";
import {
  beginElementGroup,
  clippedElementBounds,
  drawBackdropFilter,
  endElementGroup,
  fadeOf,
  isNoFilter,
} from "./group.ts";
import { drawImage } from "./image.ts";
import { computeContain, computeCover } from "./object-fit.ts";
import {
  boxShadowExtent,
  drawBoxShadow,
  drawRect,
  getBorderRadiusFromStyle,
} from "./rect.ts";
import { drawSvgContainer } from "./svg/index.ts";
import { drawText } from "./text.ts";
import { parseCSSLength, resolveBoxValue } from "./utils.ts";

/**
 * Main draw dispatcher: recursively draws the layout tree onto the canvas.
 *
 * Every node, scaled or not, is drawn straight through its transform. Text is
 * drawn unhinted and unsnapped (see `drawText`), so it lands in the same place
 * at any scale and a scaled subtree needs no supersampled offscreen buffer.
 *
 * @param inheritedOpacity - Opacity handed down by a parent that paints
 *   nothing itself and has this node as its only child (see `fadeOf`)
 */
export async function drawNode(
  ctx: SKRSContext2D,
  node: LayoutNode,
  parentX: number,
  parentY: number,
  context?: RenderContext,
  emojiStyle?: EmojiStyle,
  inheritedOpacity = 1,
): Promise<void> {
  const x = parentX + node.x;
  const y = parentY + node.y;
  const { width, height, style } = node;

  // Resolve a context once so the whole subtree shares one image cache.
  const renderContext: RenderContext = context ?? {
    imageCache: new Map(),
    debug: false,
  };

  if (style.display === "none") return;

  // A numeric string counts, as it does in CSS; anything that isn't a
  // number leaves the element opaque.
  const rawOpacity = Number(style.opacity ?? 1);
  const opacity =
    (Number.isFinite(rawOpacity) ? rawOpacity : 1) * inheritedOpacity;
  if (opacity <= 0) return;

  // Lay the text out first: how the element fades depends on what it paints.
  let text:
    | { layout: TextLayoutResult; contentX: number; contentY: number }
    | undefined;
  if (node.textContent !== undefined && node.textContent !== "") {
    const paddingTop = resolveBoxValue(style.paddingTop, width);
    const paddingLeft = resolveBoxValue(style.paddingLeft, width);
    const paddingRight = resolveBoxValue(style.paddingRight, width);

    const borderTopW = resolveBoxValue(style.borderTopWidth, width);
    const borderLeftW = resolveBoxValue(style.borderLeftWidth, width);
    const borderRightW = resolveBoxValue(style.borderRightWidth, width);

    const contentWidth =
      width - paddingLeft - paddingRight - borderLeftW - borderRightW;
    text = {
      layout: layoutText(
        node.textContent,
        style,
        contentWidth,
        ctx,
        !!emojiStyle,
      ),
      contentX: x + paddingLeft + borderLeftW,
      contentY: y + paddingTop + borderTopW,
    };
  }

  ctx.save();

  if (style.transform) {
    applyTransform(
      ctx,
      style.transform,
      x,
      y,
      width,
      height,
      style.transformOrigin,
    );
  }

  // Apply clip-path — in the element's own (transformed) coordinate space, and
  // before anything is painted, since it clips the element's entire rendering
  // including its box-shadow.
  if (style.clipPath) {
    applyClipPath(ctx, style.clipPath, style, x, y, width, height);
  }

  const borderRadius = getBorderRadiusFromStyle(style, width, height);

  // Filter the backdrop behind the border box before anything of the element
  // itself is painted: its box-shadow must not end up in the backdrop, and its
  // background composites on top of the filtered result.
  if (style.backdropFilter) {
    drawBackdropFilter(
      ctx,
      style.backdropFilter,
      x,
      y,
      width,
      height,
      borderRadius,
      opacity,
    );
  }

  // The element's own painting and its descendants form one group, composited
  // with its opacity and filter. CSS applies clip-path after the filter, so the
  // clip above also clips the filtered result. The backdrop above stays outside
  // the group: a group's backdrop is read from the enclosing one.
  const isClipped =
    style.overflow === "hidden" ||
    style.overflowX === "hidden" ||
    style.overflowY === "hidden";
  // Where a group would change nothing, the element fades without one.
  const fade =
    opacity < 1 && isNoFilter(style.filter)
      ? fadeOf(node, text?.layout, renderContext.debug)
      : "group";
  let inGroup = false;
  if (fade === "alpha") {
    ctx.globalAlpha *= opacity;
  } else if (fade === "group") {
    inGroup = beginElementGroup(
      ctx,
      opacity,
      style.filter,
      // An element that clips its content paints nothing past its border box
      // and box-shadow, so its group needs no more room than that.
      isClipped && opacity < 1
        ? clippedElementBounds(
            ctx,
            x,
            y,
            width,
            height,
            style.boxShadow ? boxShadowExtent(style.boxShadow) : 0,
          )
        : undefined,
    );
  }

  // Draw box-shadow BEFORE overflow clip — CSS overflow:hidden clips children,
  // not the element's own box-shadow.
  if (style.boxShadow) {
    drawBoxShadow(ctx, x, y, width, height, style.boxShadow, borderRadius);
  }

  // Apply clipping for overflow: hidden
  if (isClipped) {
    applyClip(ctx, x, y, width, height, borderRadius);
  }

  // Draw background and borders
  if (
    style.backgroundColor ||
    style.borderTopWidth ||
    style.borderRightWidth ||
    style.borderBottomWidth ||
    style.borderLeftWidth
  ) {
    drawRect(ctx, x, y, width, height, style);
  }

  // Draw background-image (gradient or url) — supports multiple comma-separated layers
  if (style.backgroundImage) {
    const layers = splitGradientArgs(style.backgroundImage);
    // CSS paints last layer first (bottommost)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]!.trim();
      const gradient = createGradientFromCSS(ctx, layer, x, y, width, height);
      if (gradient) {
        ctx.fillStyle = gradient;
        if (hasRadius(borderRadius)) {
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
      } else {
        // Try url(...) background image
        const urlMatch = layer.match(/url\(["']?(.*?)["']?\)/);
        if (urlMatch) {
          if (hasRadius(borderRadius)) {
            applyClip(ctx, x, y, width, height, borderRadius);
          }

          const image = await cachedLoadImage(
            renderContext.imageCache,
            urlMatch[1]!,
            renderContext.userAgent,
          );
          const bgSize = style.backgroundSize;

          if (bgSize === "cover") {
            // Cover fills the box completely — no tiling needed
            const r = computeCover(
              image.width,
              image.height,
              x,
              y,
              width,
              height,
            );
            ctx.drawImage(
              image,
              r.sx,
              r.sy,
              r.sw,
              r.sh,
              r.dx,
              r.dy,
              r.dw,
              r.dh,
            );
          } else {
            // Compute tile dimensions based on backgroundSize
            let tileW: number, tileH: number;
            if (bgSize === "contain") {
              const r = computeContain(
                image.width,
                image.height,
                0,
                0,
                width,
                height,
              );
              tileW = r.dw;
              tileH = r.dh;
            } else if (bgSize === "100% 100%") {
              tileW = width;
              tileH = height;
            } else {
              // CSS default (auto): natural image size
              tileW = image.width;
              tileH = image.height;
            }
            const repeat = style.backgroundRepeat ?? "repeat";
            const stepX =
              repeat === "repeat" || repeat === "repeat-x" ? tileW : width;
            const stepY =
              repeat === "repeat" || repeat === "repeat-y" ? tileH : height;
            for (let ty = y; ty < y + height; ty += stepY) {
              for (let tx = x; tx < x + width; tx += stepX) {
                ctx.drawImage(image, tx, ty, tileW, tileH);
              }
            }
          }
        }
      }
    }
  }

  // Debug: draw bounding boxes
  if (renderContext.debug) {
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  // Draw text content
  if (text) {
    await drawText(
      ctx,
      text.layout.segments,
      text.contentX,
      text.contentY,
      style.textShadow,
      emojiStyle,
      text.layout.paragraph && {
        paragraph: text.layout.paragraph,
        offsetY: text.layout.paragraphOffsetY ?? 0,
      },
    );
  }

  // Draw <img> elements
  if (node.type === "img" && node.props.src) {
    const paddingTop = resolveBoxValue(style.paddingTop, width);
    const paddingLeft = resolveBoxValue(style.paddingLeft, width);
    const paddingRight = resolveBoxValue(style.paddingRight, width);
    const paddingBottom = resolveBoxValue(style.paddingBottom, width);

    const borderTopW = resolveBoxValue(style.borderTopWidth, width);
    const borderLeftW = resolveBoxValue(style.borderLeftWidth, width);
    const borderRightW = resolveBoxValue(style.borderRightWidth, width);
    const borderBottomW = resolveBoxValue(style.borderBottomWidth, width);

    const imgX = x + paddingLeft + borderLeftW;
    const imgY = y + paddingTop + borderTopW;
    const imgW =
      width - paddingLeft - paddingRight - borderLeftW - borderRightW;
    const imgH =
      height - paddingTop - paddingBottom - borderTopW - borderBottomW;

    // Images are replaced content — borderRadius clips them directly
    // (unlike child content which requires overflow:hidden)
    if (!isClipped) {
      if (hasRadius(borderRadius)) {
        applyClip(ctx, imgX, imgY, imgW, imgH, borderRadius);
      }
    }

    await drawImage(
      ctx,
      node.props.src as string | Buffer,
      imgX,
      imgY,
      imgW,
      imgH,
      renderContext,
      style,
    );
  }

  // Draw <svg> containers (handle their own child traversal in SVG coordinate space)
  if (node.type === "svg") {
    drawSvgContainer(ctx, node, x, y, width, height);
  } else {
    for (const child of node.children) {
      await drawNode(
        ctx,
        child,
        x,
        y,
        renderContext,
        emojiStyle,
        fade === "through" ? opacity : 1,
      );
    }
  }

  if (inGroup) endElementGroup(ctx);
  ctx.restore();
}

function applyTransform(
  ctx: SKRSContext2D,
  transform: string,
  x: number,
  y: number,
  width: number,
  height: number,
  transformOrigin?: string,
): void {
  // Resolve transform-origin (default: center)
  let ox = x + width / 2;
  let oy = y + height / 2;

  if (transformOrigin) {
    const parts = transformOrigin.split(/\s+/);
    ox = resolveOrigin(parts[0], x, width);
    oy = resolveOrigin(parts[1], y, height);
  }

  ctx.translate(ox, oy);

  // Parse and apply transform functions
  const funcs = transform.matchAll(/(\w+)\(([^)]+)\)/g);

  for (const [, name, args] of funcs) {
    const values = args!.split(",").map((s) => s.trim());

    switch (name) {
      case "translate":
      case "translateX":
      case "translateY": {
        const tx =
          name === "translateY" ? 0 : parseCSSLength(values[0]!, width);
        const ty =
          name === "translateX"
            ? 0
            : parseCSSLength(
                values[name === "translate" ? 1 : 0] ?? "0",
                height,
              );
        ctx.translate(tx, ty);
        break;
      }
      case "scale":
      case "scaleX":
      case "scaleY": {
        const sx = name === "scaleY" ? 1 : parseFloat(values[0]!);
        const sy =
          name === "scaleX"
            ? 1
            : parseFloat(values[name === "scale" ? 1 : 0] ?? String(sx));
        ctx.scale(sx, sy);
        break;
      }
      case "rotate": {
        const angle = parseAngle(values[0]!);
        ctx.rotate(angle);
        break;
      }
      case "skewX": {
        const angle = parseAngle(values[0]!);
        ctx.transform(1, 0, Math.tan(angle), 1, 0, 0);
        break;
      }
      case "skewY": {
        const angle = parseAngle(values[0]!);
        ctx.transform(1, Math.tan(angle), 0, 1, 0, 0);
        break;
      }
    }
  }

  ctx.translate(-ox, -oy);
}

function resolveOrigin(
  value: string | undefined,
  base: number,
  size: number,
): number {
  if (!value) return base + size / 2;
  if (value === "left" || value === "top") return base;
  if (value === "right" || value === "bottom") return base + size;
  if (value === "center") return base + size / 2;
  return base + parseCSSLength(value, size);
}

function parseAngle(value: string): number {
  if (value.endsWith("deg")) return (parseFloat(value) * Math.PI) / 180;
  if (value.endsWith("rad")) return parseFloat(value);
  if (value.endsWith("turn")) return parseFloat(value) * 2 * Math.PI;
  return parseFloat(value);
}
