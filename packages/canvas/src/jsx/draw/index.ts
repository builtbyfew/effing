import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";

import type { EmojiStyle } from "../emoji.ts";
import { cachedLoadImage } from "../../image.ts";
import type { LayoutNode } from "../layout.ts";
import type { RenderContext } from "../context.ts";
import { layoutText } from "../text/index.ts";
import { drawBackdropFilter, filterBleed } from "./backdrop-filter.ts";
import { applyClip, hasRadius, roundedRect } from "./clip.ts";
import { applyClipPath } from "./clip-path.ts";
import { createGradientFromCSS, splitGradientArgs } from "./gradient.ts";
import { drawImage } from "./image.ts";
import { computeContain, computeCover } from "./object-fit.ts";
import { acquireOffscreen, releaseOffscreen } from "./offscreen.ts";
import {
  boxShadowExtent,
  drawBoxShadow,
  drawRect,
  getBorderRadiusFromStyle,
} from "./rect.ts";
import { drawSvgContainer } from "./svg/index.ts";
import { drawText } from "./text.ts";
import { parseCSSLength, resolveBoxValue, transformedBounds } from "./utils.ts";
import type { Matrix } from "./utils.ts";

/**
 * Main draw dispatcher: recursively draws the layout tree onto the canvas.
 */
export async function drawNode(
  ctx: SKRSContext2D,
  node: LayoutNode,
  parentX: number,
  parentY: number,
  context?: RenderContext,
  emojiStyle?: EmojiStyle,
): Promise<void> {
  const x = parentX + node.x;
  const y = parentY + node.y;
  const { width, height, style } = node;

  // Resolve a context once so children and the offscreen path share one cache.
  const renderContext: RenderContext = context ?? {
    imageCache: new Map(),
    debug: false,
  };

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
  // A backdrop-filter anywhere in the subtree also bypasses it: the filter
  // samples the canvas it draws on, and an offscreen buffer holds none of the
  // content behind the element.
  const subtree =
    scaleInfo &&
    (scaleInfo.sx !== 1 || scaleInfo.sy !== 1) &&
    !hasOtherTransforms
      ? scanSubtree(node)
      : null;

  // The offscreen buffer has hard pixel bounds, so anything painted past its
  // edge is clipped. A CSS transform must never clip the element's own
  // content, yet ink legitimately overflows the layout box — glyph side
  // bearings, italic overhang, and negative letter-spacing all push paint
  // past the content edge (as do box-shadows). Grow the buffer by that much
  // on every side so transformed content keeps the overflow the untransformed
  // element would paint. Rounded up to whole pixels: with a fractional bleed
  // (e.g. from a fractional font size) the buffer size below would be
  // ceil'd past the logical box it's composited into, shrinking the content
  // by up to a pixel, and the box would sit off the pixel grid in the buffer.
  const bleed = subtree ? Math.max(1, Math.ceil(subtree.overflowBleed)) : 0;

  // Logical size of the bleed-expanded box. A degenerate size (zero, negative
  // or NaN from a layout edge case) can't back a buffer, so such nodes skip
  // the offscreen path and draw directly like any other node.
  const boxWidth = width + 2 * bleed;
  const boxHeight = height + 2 * bleed;

  if (
    scaleInfo &&
    subtree &&
    !subtree.hasBackdropFilter &&
    boxWidth > 0 &&
    boxHeight > 0
  ) {
    const sx = scaleInfo.sx;
    const sy = scaleInfo.sy;
    const transformWithoutScale = scaleInfo.remaining;

    let ox = x + width / 2;
    let oy = y + height / 2;
    if (style.transformOrigin) {
      const parts = style.transformOrigin.split(/\s+/);
      ox = resolveOrigin(parts[0], x, width);
      oy = resolveOrigin(parts[1], y, height);
    }

    // Render the subtree at qx×qy resolution — logical coords produce more
    // pixels. Offset by `bleed` so the box sits inside the buffer with room
    // for overflow on every side.
    const render = async (qx: number, qy: number) => {
      const [offscreen, offCtx] = acquireOffscreen(
        Math.ceil(boxWidth * qx),
        Math.ceil(boxHeight * qy),
      );
      offCtx.save();
      offCtx.scale(qx, qy);
      await drawNodeCore(
        offCtx,
        node,
        parentX,
        parentY,
        bleed - x,
        bleed - y,
        emojiStyle,
        renderContext,
        transformWithoutScale,
      );
      offCtx.restore();
      return offscreen;
    };

    // Draw a buffer back at logical size under the original scale (the
    // q→1x downscale happens here). Source and dest both span the
    // bleed-expanded box, so the overflow region maps back to the same place
    // it would paint untransformed. The node's opacity is already in the
    // buffer (drawNodeCore applies it), so it isn't applied again here.
    const composite = (target: SKRSContext2D, offscreen: Canvas) => {
      target.save();
      target.translate(ox, oy);
      target.scale(sx, sy);
      target.translate(-ox, -oy);
      target.drawImage(
        offscreen,
        0,
        0,
        offscreen.width,
        offscreen.height,
        x - bleed,
        y - bleed,
        boxWidth,
        boxHeight,
      );
      target.restore();
    };

    const levels = supersampleLevels(sx, sy, subtree.hasText);
    if (levels.length === 1) {
      const offscreen = await render(levels[0]!.qx, levels[0]!.qy);
      composite(ctx, offscreen);
      releaseOffscreen(offscreen);
    } else {
      // Device-space bounds of the scaled bleed box.
      const m = ctx.getTransform();
      const x0 = ox + sx * (x - bleed - ox);
      const x1 = ox + sx * (x + width + bleed - ox);
      const y0 = oy + sy * (y - bleed - oy);
      const y1 = oy + sy * (y + height + bleed - oy);
      const bounds = transformedBounds(
        m,
        Math.min(x0, x1),
        Math.min(y0, y1),
        Math.abs(x1 - x0),
        Math.abs(y1 - y0),
      );
      await drawBlended(ctx, m, bounds, levels, render, composite);
    }
    return;
  }

  await drawNodeCore(
    ctx,
    node,
    parentX,
    parentY,
    0,
    0,
    emojiStyle,
    renderContext,
  );
}

/**
 * Width of the band just above each whole scale in which the offscreen path
 * cross-fades between the two neighbouring supersample factors.
 */
const SUPERSAMPLE_BLEND_BAND = 0.05;

/**
 * Levels weighing less than this are dropped: below one 8-bit step at full
 * coverage they can't change a pixel, and float noise such as a scale of
 * 1.0000000000000002 would otherwise pay for a whole second render. Applied
 * to the final level list, so for a non-uniform scale the pruning sees the
 * product weights, not just the per-axis ones.
 */
const SUPERSAMPLE_MIN_WEIGHT = 1 / 512;

/**
 * The blended layer's device-space bounds are snapped to this grid so its size
 * (and so the offscreen pool key) stays stable while the scale animates.
 */
const BLEND_LAYER_GRID = 64;

type SupersampleLevel = { qx: number; qy: number; weight: number };

/**
 * The supersample factors to render a pure-scale subtree at, with the weight
 * each contributes to the composite.
 *
 * The factor is quantized to ceil(|scale|), so a buffer only changes at whole
 * scales (no per-frame glyph jitter) and the composite is always ≤1x (sharp).
 * But Skia hints glyphs and snaps pen positions and baselines on the device
 * grid, so text rasterized at q× doesn't land exactly where it does at 1× or
 * (q+1)×: switching factors outright made text jump by a fraction of a pixel
 * whenever an animated scale crossed a whole number. Instead, just past each
 * whole scale k, fade from the k× buffer to the (k+1)× one, so the rendered
 * result is continuous in the scale. Scale 1 itself draws directly, which
 * matches the 1× buffer. Without text there is nothing to fade (boxes, images
 * and paths land the same at any factor), so `blend: false` skips the extra
 * render.
 *
 * The band trades the jump for softness: inside it the text is the average of
 * two rasterizations up to about a pixel apart, so a slow zoom that stays
 * within the band (say 1 → 1.05) is slightly soft throughout. A narrower band
 * shortens that stretch but concentrates the same shift into fewer frames.
 */
function supersampleLevels(
  sx: number,
  sy: number,
  blend: boolean,
): SupersampleLevel[] {
  const axis = (s: number): { q: number; weight: number }[] => {
    const a = Math.abs(s);
    const q = Math.max(1, Math.ceil(a));
    const t = (a - (q - 1)) / SUPERSAMPLE_BLEND_BAND;
    if (!blend || q === 1 || t >= 1) return [{ q, weight: 1 }];
    return [
      { q: q - 1, weight: 1 - t },
      { q, weight: t },
    ];
  };
  const xs = axis(sx);
  // A non-uniform scale blends each axis independently, so its levels are
  // every combination of the two axes' factors, weighted by the product.
  const levels =
    Math.abs(sx) === Math.abs(sy)
      ? xs.map(({ q, weight }) => ({ qx: q, qy: q, weight }))
      : xs.flatMap((lx) =>
          axis(sy).map((ly) => ({
            qx: lx.q,
            qy: ly.q,
            weight: lx.weight * ly.weight,
          })),
        );

  // Drop levels too faint to change a pixel and renormalise the rest, so the
  // weights still sum to 1 (drawBlended relies on that to average exactly).
  const kept = levels.filter((l) => l.weight >= SUPERSAMPLE_MIN_WEIGHT);
  const total = kept.reduce((sum, l) => sum + l.weight, 0);
  return kept.map((l) => ({ ...l, weight: l.weight / total }));
}

/**
 * Paint the weighted average of several supersample levels, where `bounds` is
 * the device-space area they cover under the context's transform `m`.
 *
 * Each level is composited additively (`lighter`) at its weight onto one
 * transparent device-space layer, which is then drawn back once with the
 * context's own state. Source-over is linear in the premultiplied source and
 * the weights sum to 1, so that equals averaging the levels each composited
 * over the destination — exact over transparent pixels too, with the context's
 * clip, alpha and composite operation applied once on the final draw. A filter
 * set on the context is applied per level on the layer instead, under the same
 * transform, exactly as the single-buffer path applies it.
 */
async function drawBlended(
  ctx: SKRSContext2D,
  m: Matrix,
  bounds: ReturnType<typeof transformedBounds>,
  levels: SupersampleLevel[],
  render: (qx: number, qy: number) => Promise<Canvas>,
  composite: (target: SKRSContext2D, offscreen: Canvas) => void,
): Promise<void> {
  // An ancestor's filter (still set on the context) can paint past the
  // element's bounds — a blur's halo, a drop-shadow's offset copy — and
  // anything outside the layer would be lost. Grow the layer by the filter's
  // reach, scaled generously in case its lengths follow the transform.
  const filter = ctx.filter;
  const pad =
    filter && filter !== "none"
      ? Math.ceil(
          filterBleed(filter) *
            Math.max(1, Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)),
        )
      : 0;
  const grid = BLEND_LAYER_GRID;
  const rx = Math.max(0, Math.floor((bounds.x0 - pad) / grid) * grid);
  const ry = Math.max(0, Math.floor((bounds.y0 - pad) / grid) * grid);
  const rw =
    Math.min(ctx.canvas.width, Math.ceil((bounds.x1 + pad) / grid) * grid) - rx;
  const rh =
    Math.min(ctx.canvas.height, Math.ceil((bounds.y1 + pad) / grid) * grid) -
    ry;
  if (rw <= 0 || rh <= 0) return;

  const [layer, layerCtx] = acquireOffscreen(rw, rh);
  layerCtx.setTransform(m.a, m.b, m.c, m.d, m.e - rx, m.f - ry);
  layerCtx.filter = filter;
  layerCtx.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
  layerCtx.imageSmoothingQuality = ctx.imageSmoothingQuality;
  layerCtx.globalCompositeOperation = "lighter";
  for (const { qx, qy, weight } of levels) {
    const offscreen = await render(qx, qy);
    layerCtx.globalAlpha = weight;
    composite(layerCtx, offscreen);
    releaseOffscreen(offscreen);
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.drawImage(layer, rx, ry);
  ctx.restore();
  releaseOffscreen(layer);
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

/** Font size `layoutText` draws with when the style specifies none. */
const DEFAULT_FONT_SIZE = 16;

/**
 * One walk over the visible part of a subtree (nodes that are `display: none`
 * or fully transparent are skipped, as they are when drawing) collecting what
 * the offscreen scale path needs to know:
 *
 * - `overflowBleed`: how far the subtree's painting can extend beyond its
 *   layout box, in logical (pre-scale) pixels, to size the offscreen buffer so
 *   its hard pixel bounds don't slice ink that legitimately overflows the box.
 *   Glyph ink overhangs its advance box by up to roughly one em (side
 *   bearings, italics, accents), and negative letter-spacing trims the box
 *   while leaving the trailing glyph's ink in place — so it overflows by the
 *   magnitude of the spacing. Box-shadows extend the painted area too. The
 *   result is a single symmetric margin (the max needed on any side).
 * - `hasBackdropFilter`: whether any node applies a backdrop-filter, which
 *   needs the real canvas behind it and so rules out the offscreen path.
 * - `hasText`: whether any node draws text, the only content whose placement
 *   depends on the supersample factor (see `supersampleLevels`).
 */
function scanSubtree(node: LayoutNode): {
  overflowBleed: number;
  hasBackdropFilter: boolean;
  hasText: boolean;
} {
  let overflowBleed = 0;
  let hasBackdropFilter = false;
  let hasText = false;

  const visit = (n: LayoutNode): void => {
    if (n.style.display === "none") return;
    if ((n.style.opacity ?? 1) <= 0) return;

    if (n.textContent !== undefined && n.textContent !== "") {
      hasText = true;
      // Text is drawn even when the style carries no fontSize (layoutText
      // falls back to the 16px default), so size the bleed the same way.
      const fontSize =
        typeof n.style.fontSize === "number"
          ? n.style.fontSize
          : DEFAULT_FONT_SIZE;
      const letterSpacing =
        typeof n.style.letterSpacing === "number" ? n.style.letterSpacing : 0;
      overflowBleed = Math.max(
        overflowBleed,
        fontSize + Math.max(0, -letterSpacing),
      );
    }

    if (n.style.boxShadow) {
      overflowBleed = Math.max(
        overflowBleed,
        boxShadowExtent(n.style.boxShadow),
      );
    }

    const filter = n.style.backdropFilter;
    if (filter && filter.trim() !== "none") hasBackdropFilter = true;

    for (const child of n.children) visit(child);
  };

  visit(node);
  return { overflowBleed, hasBackdropFilter, hasText };
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
  emojiStyle: EmojiStyle | undefined,
  context: RenderContext,
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

  // Apply clip-path — in the element's own (transformed) coordinate space, and
  // before anything is painted, since it clips the element's entire rendering
  // including its box-shadow.
  if (style.clipPath) {
    applyClipPath(ctx, style.clipPath, style, x, y, width, height);
  }

  const borderRadius = getBorderRadiusFromStyle(style, width, height);

  // Filter the backdrop behind the border box before anything of the element
  // itself is painted: its box-shadow must not end up in the snapshot, and its
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
    );
  }

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

          const image = await cachedLoadImage(
            context.imageCache,
            urlMatch[1]!,
            context.userAgent,
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
  if (context.debug) {
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
      context,
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
        await drawNode(ctx, child, x, y, context, emojiStyle);
      } else {
        await drawNodeCore(ctx, child, x, y, 0, 0, emojiStyle, context);
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
