import { Canvas } from "skia-canvas";
import type { CanvasRenderingContext2D, Image } from "skia-canvas";

import type { LayoutNode, Style } from "./types.ts";
import { configureFont } from "./text.ts";
import { loadImageFromSrc } from "./image.ts";

// ---------------------------------------------------------------------------
// Border-radius helper
// ---------------------------------------------------------------------------

function getBorderRadii(
  style: Style,
): [number, number, number, number] | undefined {
  const br = style.borderRadius;
  if (br == null) return undefined;

  if (typeof br === "number") return [br, br, br, br];

  const tl = Number(style.borderTopLeftRadius ?? br) || 0;
  const tr = Number(style.borderTopRightRadius ?? br) || 0;
  const blr = Number(style.borderBottomRightRadius ?? br) || 0;
  const bl = Number(style.borderBottomLeftRadius ?? br) || 0;
  return [tl, tr, blr, bl];
}

// ---------------------------------------------------------------------------
// Draw a single node
// ---------------------------------------------------------------------------

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  images: Map<string | Buffer, Image>,
): void {
  const { left, top, width, height, style } = node;

  ctx.save();
  ctx.translate(left, top);

  // Clipping for overflow: hidden
  const overflow = style.overflow;
  const radii = getBorderRadii(style);
  if (overflow === "hidden" || radii) {
    ctx.beginPath();
    if (radii) {
      ctx.roundRect(0, 0, width, height, radii);
    } else {
      ctx.rect(0, 0, width, height);
    }
    ctx.clip();
  }

  // Opacity
  const opacity = style.opacity;
  if (opacity != null) {
    ctx.globalAlpha *= Number(opacity);
  }

  // Background color
  const bg = style.backgroundColor ?? style.background;
  if (bg != null) {
    ctx.fillStyle = String(bg);
    if (radii) {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, radii);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Border
  const borderWidth = Number(style.borderWidth) || 0;
  const borderColor = style.borderColor;
  if (borderWidth > 0 && borderColor) {
    ctx.strokeStyle = String(borderColor);
    ctx.lineWidth = borderWidth;
    const offset = borderWidth / 2;
    ctx.beginPath();
    if (radii) {
      const insetRadii = radii.map((r) => Math.max(0, r - offset));
      ctx.roundRect(
        offset,
        offset,
        width - borderWidth,
        height - borderWidth,
        insetRadii,
      );
    } else {
      ctx.rect(offset, offset, width - borderWidth, height - borderWidth);
    }
    ctx.stroke();
  }

  // Image rendering
  if (node.imgSrc) {
    const img = images.get(node.imgSrc);
    if (img) {
      ctx.drawImage(img, 0, 0, width, height);
    }
  }

  // Text rendering
  if (node.text) {
    const color = style.color ?? "black";
    ctx.fillStyle = String(color);
    configureFont(ctx, style);
    ctx.textWrap = true;
    ctx.textBaseline = "top";

    // Account for padding
    const padTop = Number(style.paddingTop ?? style.padding) || 0;
    const padLeft = Number(style.paddingLeft ?? style.padding) || 0;
    const padRight = Number(style.paddingRight ?? style.padding) || 0;
    const maxTextWidth = width - padLeft - padRight;

    // Handle textAlign positioning
    const textAlign = String(style.textAlign ?? "left");
    let textX = padLeft;
    if (textAlign === "center") {
      textX = padLeft + maxTextWidth / 2;
    } else if (textAlign === "right" || textAlign === "end") {
      textX = padLeft + maxTextWidth;
    }

    // Handle lineHeight
    const lineHeight = style.lineHeight;
    if (lineHeight != null) {
      const fontSize = Number(style.fontSize) || 16;
      const lh =
        typeof lineHeight === "number"
          ? lineHeight
          : parseFloat(String(lineHeight));
      if (!Number.isNaN(lh)) {
        // If lineHeight > 1 and looks like a multiplier, convert to px
        const lineHeightPx = lh > 0 && lh < 10 ? lh * fontSize : lh;
        // Offset text by half the leading
        const leading = lineHeightPx - fontSize;
        if (leading > 0) {
          ctx.translate(0, leading / 2);
        }
      }
    }

    ctx.fillText(
      node.text,
      textX,
      padTop,
      maxTextWidth > 0 ? maxTextWidth : undefined,
    );
  }

  // Recurse into children
  for (const child of node.children) {
    drawNode(ctx, child, images);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderToPngBuffer(
  layoutTree: LayoutNode,
  width: number,
  height: number,
  imageSources: (string | Buffer)[],
): Promise<Buffer> {
  // Pre-load images
  const images = new Map<string | Buffer, Image>();
  const loaded = await Promise.all(imageSources.map(loadImageFromSrc));
  for (let i = 0; i < imageSources.length; i++) {
    images.set(imageSources[i], loaded[i]);
  }

  const canvas = new Canvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw the layout tree
  drawNode(ctx, layoutTree, images);

  return canvas.toBuffer("png");
}

// ---------------------------------------------------------------------------
// Collect all image sources from a layout tree
// ---------------------------------------------------------------------------

export function collectImageSources(node: LayoutNode): (string | Buffer)[] {
  const sources: (string | Buffer)[] = [];
  function walk(n: LayoutNode) {
    if (n.imgSrc) sources.push(n.imgSrc);
    for (const child of n.children) walk(child);
  }
  walk(node);
  return sources;
}
