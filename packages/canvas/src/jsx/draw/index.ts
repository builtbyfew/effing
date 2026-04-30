import type { SKRSContext2D } from "@napi-rs/canvas";

import type { EmojiStyle } from "../emoji.ts";
import type { ImageCache } from "../image-cache.ts";
import { cachedLoadImage } from "../image-cache.ts";
import type { LayoutNode } from "../layout.ts";
import { layoutText } from "../text/index.ts";
import { applyClip, hasRadius, roundedRect } from "./clip.ts";
import { createGradientFromCSS, splitGradientArgs } from "./gradient.ts";
import { drawImage } from "./image.ts";
import { computeContain, computeCover } from "./object-fit.ts";
import { acquireOffscreen, releaseOffscreen } from "./offscreen.ts";
import { drawBoxShadow, drawRect, getBorderRadiusFromStyle } from "./rect.ts";
import { drawSvgContainer } from "./svg/index.ts";
import { drawText } from "./text.ts";
import { parseCSSLength, resolveBoxValue } from "./utils.ts";

/**
 * Main draw dispatcher: recursively draws the layout tree onto the canvas.
 */
export async function drawNode(
  ctx: SKRSContext2D,
  node: LayoutNode,
  parentX: number,
  parentY: number,
  debug: boolean,
  emojiStyle?: EmojiStyle,
  imageCache?: ImageCache,
): Promise<void> {
  const x = parentX + node.x;
  const y = parentY + node.y;
  const { width, height, style } = node;

  if (style.display === "none") return;

  const opacity = style.opacity ?? 1;
  if (opacity <= 0) return;

  // Detect pure-scale transforms — render to offscreen buffer at 1x then
  // composite scaled, to avoid Skia re-rasterizing glyphs per-frame.
  // Mixed transforms (scale combined with translate/rotate/skew) bypass this
  // path because the layout-box-sized offscreen would clip any drawing the
  // translate/rotate moves outside that box.
  const scaleInfo = style.transform ? extractScale(style.transform) : null;
  const hasOtherTransforms =
    scaleInfo !== null && scaleInfo.remaining.length > 0;
  if (
    scaleInfo &&
    (scaleInfo.sx !== 1 || scaleInfo.sy !== 1) &&
    !hasOtherTransforms
  ) {
    const sx = scaleInfo.sx;
    const sy = scaleInfo.sy;
    const transformWithoutScale = scaleInfo.remaining;

    // Quantize to ceil(|scale|) — buffer resolution only changes at
    // integer boundaries (no jitter), and composite is always ≤1x (sharp).
    const qx = Math.max(1, Math.ceil(Math.abs(sx)));
    const qy = Math.max(1, Math.ceil(Math.abs(sy)));

    const bufW = Math.ceil((width + 2) * qx);
    const bufH = Math.ceil((height + 2) * qy);
    if (bufW > 0 && bufH > 0) {
      const [offscreen, offCtx] = acquireOffscreen(bufW, bufH);

      // Render at qx×qy resolution — logical coords produce more pixels
      offCtx.save();
      offCtx.scale(qx, qy);
      const cache: ImageCache = imageCache ?? new Map();
      await drawNodeCore(
        offCtx,
        node,
        parentX,
        parentY,
        1 - x,
        1 - y,
        debug,
        emojiStyle,
        cache,
        transformWithoutScale,
      );
      offCtx.restore();

      ctx.save();
      if (opacity < 1) {
        ctx.globalAlpha *= opacity;
      }

      let ox = x + width / 2;
      let oy = y + height / 2;
      if (style.transformOrigin) {
        const parts = style.transformOrigin.split(/\s+/);
        ox = resolveOrigin(parts[0], x, width);
        oy = resolveOrigin(parts[1], y, height);
      }

      // Apply the original scale — drawImage maps the high-res buffer
      // back to logical size, so the transform needs the full scale value.
      ctx.translate(ox, oy);
      ctx.scale(sx, sy);
      ctx.translate(-ox, -oy);

      // Draw high-res buffer back at logical size (qx→1x downscale happens here)
      ctx.drawImage(
        offscreen,
        0,
        0,
        bufW,
        bufH,
        x - 1,
        y - 1,
        width + 2,
        height + 2,
      );
      releaseOffscreen(offscreen);
      ctx.restore();
      return;
    }
  }

  const cache: ImageCache = imageCache ?? new Map();
  await drawNodeCore(
    ctx,
    node,
    parentX,
    parentY,
    0,
    0,
    debug,
    emojiStyle,
    cache,
  );
}

/**
 * Extract scale(sx, sy) from a transform string, returning the scale values
 * and the remaining transform with scale removed.
 */
function extractScale(
  transform: string,
): { sx: number; sy: number; remaining: string } | null {
  const scaleMatch = transform.match(/\b(scale|scaleX|scaleY)\(([^)]+)\)/);
  if (!scaleMatch) return null;

  const [fullMatch, name, args] = scaleMatch;
  const values = args!.split(",").map((s) => s.trim());

  const sx = name === "scaleY" ? 1 : parseFloat(values[0]!);
  const sy =
    name === "scaleX"
      ? 1
      : parseFloat(values[name === "scale" ? 1 : 0] ?? String(sx));

  const remaining = transform.replace(fullMatch!, "").trim();
  return { sx, sy, remaining };
}

/**
 * Core draw logic shared by both the normal path and the offscreen-buffer path.
 * offsetX/offsetY shift all coordinates so the node renders at a buffer-local position.
 * overrideTransform replaces the node's transform (used to strip scale for offscreen).
 */
async function drawNodeCore(
  ctx: SKRSContext2D,
  node: LayoutNode,
  parentX: number,
  parentY: number,
  offsetX: number,
  offsetY: number,
  debug: boolean,
  emojiStyle: EmojiStyle | undefined,
  imageCache: ImageCache,
  overrideTransform?: string,
): Promise<void> {
  const x = parentX + node.x + offsetX;
  const y = parentY + node.y + offsetY;
  const { width, height, style } = node;

  if (style.display === "none") return;

  const opacity = style.opacity ?? 1;
  if (opacity <= 0) return;

  ctx.save();

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha *= opacity;
  }

  // Apply CSS filter
  if (style.filter) {
    ctx.filter = style.filter;
  }

  // Apply transform (use override when provided, e.g. scale stripped)
  const transformToApply =
    overrideTransform !== undefined ? overrideTransform : style.transform;
  if (transformToApply) {
    applyTransform(
      ctx,
      transformToApply,
      x,
      y,
      width,
      height,
      style.transformOrigin,
    );
  }

  const borderRadius = getBorderRadiusFromStyle(style, width, height);

  // Draw box-shadow BEFORE overflow clip — CSS overflow:hidden clips children,
  // not the element's own box-shadow.
  if (style.boxShadow) {
    drawBoxShadow(ctx, x, y, width, height, style.boxShadow, borderRadius);
  }

  // Apply clipping for overflow: hidden
  const isClipped =
    style.overflow === "hidden" ||
    style.overflowX === "hidden" ||
    style.overflowY === "hidden";

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

          const image = await cachedLoadImage(imageCache, urlMatch[1]!);
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
            // Tile the image to fill the box (CSS background-repeat: repeat)
            for (let ty = y; ty < y + height; ty += tileH) {
              for (let tx = x; tx < x + width; tx += tileW) {
                ctx.drawImage(image, tx, ty, tileW, tileH);
              }
            }
          }
        }
      }
    }
  }

  // Debug: draw bounding boxes
  if (debug) {
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  // Draw text content
  if (node.textContent !== undefined && node.textContent !== "") {
    const paddingTop = resolveBoxValue(style.paddingTop, width);
    const paddingLeft = resolveBoxValue(style.paddingLeft, width);
    const paddingRight = resolveBoxValue(style.paddingRight, width);

    const borderTopW = resolveBoxValue(style.borderTopWidth, width);
    const borderLeftW = resolveBoxValue(style.borderLeftWidth, width);
    const borderRightW = resolveBoxValue(style.borderRightWidth, width);

    const contentX = x + paddingLeft + borderLeftW;
    const contentY = y + paddingTop + borderTopW;
    const contentWidth =
      width - paddingLeft - paddingRight - borderLeftW - borderRightW;

    const textLayout = layoutText(
      node.textContent,
      style,
      contentWidth,
      ctx,
      !!emojiStyle,
    );
    await drawText(
      ctx,
      textLayout.segments,
      contentX,
      contentY,
      style.textShadow,
      emojiStyle,
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
      imageCache,
      style,
    );
  }

  // Draw <svg> containers (handle their own child traversal in SVG coordinate space)
  if (node.type === "svg") {
    drawSvgContainer(ctx, node, x, y, width, height);
  } else {
    // Recursively draw children
    // When rendering via offset (offscreen buffer), children use offset 0
    // since x,y already incorporates the offset.
    for (const child of node.children) {
      if (offsetX === 0 && offsetY === 0) {
        await drawNode(ctx, child, x, y, debug, emojiStyle, imageCache);
      } else {
        await drawNodeCore(
          ctx,
          child,
          x,
          y,
          0,
          0,
          debug,
          emojiStyle,
          imageCache,
        );
      }
    }
  }

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
