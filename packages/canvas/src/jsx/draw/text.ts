import { loadImage } from "@effing/skia";
import type { SKRSContext2D, Image } from "@effing/skia";
import { fillParagraph, strokeParagraph } from "@effing/skia/extensions";

import parseCssColor from "parse-css-color";

import type { EmojiStyle } from "../emoji.ts";
import { emojiUrl, loadEmoji } from "../emoji.ts";
import type {
  PlacedEmoji,
  TextLayoutResult,
  TextSegment,
} from "../text/index.ts";
import { setFont } from "../text/measure.ts";
import type { Shadow } from "./shadow.ts";
import { paintShadow, parseTextShadow } from "./shadow.ts";

const emojiImageCache = new Map<string, Promise<Image | null>>();

function loadEmojiImage(
  style: EmojiStyle,
  emoji: string,
): Promise<Image | null> {
  const key = emojiUrl(style, emoji);
  let cached = emojiImageCache.get(key);
  if (!cached) {
    cached = loadEmoji(style, emoji)
      .then((svgText) => {
        if (!svgText || !svgText.includes("<svg")) return null;
        const dataUri =
          "data:image/svg+xml;base64," +
          Buffer.from(svgText).toString("base64");
        return loadImage(dataUri);
      })
      .catch(() => null);
    emojiImageCache.set(key, cached);
  }
  return cached;
}

/**
 * Draw laid-out text onto the canvas context: the paragraph, unhinted and
 * unsnapped, with its shadow, stroke and decorations, and the emoji drawn as
 * images in the inline boxes it left them.
 *
 * @param ctx - Canvas 2D rendering context
 * @param layout - The text as laid out by `layoutText`
 * @param offsetX - X offset for the text block
 * @param offsetY - Y offset for the text block
 * @param textShadow - Optional text-shadow CSS value
 * @param emojiStyle - The emoji style the text was laid out for, if any
 */
export async function drawText(
  ctx: SKRSContext2D,
  layout: TextLayoutResult,
  offsetX: number,
  offsetY: number,
  textShadow?: string,
  emojiStyle?: EmojiStyle,
): Promise<void> {
  const { paragraph, segments, emoji } = layout;
  const first = segments[0];
  if (!first) return;
  const x = offsetX;
  const y = offsetY + layout.paragraphOffsetY;
  const shadows = textShadow ? parseTextShadow(textShadow, first.color) : [];
  ctx.fillStyle = first.color;

  // Each pass is a single native call for the whole paragraph. The shadows
  // paint back to front: the first listed is on top.
  for (let i = shadows.length - 1; i >= 0; i--) {
    drawShadowPass(
      ctx,
      shadows[i]!,
      getColorAlpha(first.color),
      layout,
      x,
      y,
      () => fillParagraph(ctx, paragraph, x, y),
    );
  }
  if (first.textStrokeWidth !== undefined && first.textStrokeWidth > 0) {
    ctx.save();
    ctx.lineWidth = first.textStrokeWidth;
    ctx.strokeStyle = first.textStrokeColor ?? first.color;
    ctx.lineJoin = "round";
    strokeParagraph(ctx, paragraph, x, y);
    ctx.restore();
  }
  fillParagraph(ctx, paragraph, x, y);

  if (emojiStyle && emoji.length > 0) {
    await drawEmoji(ctx, emoji, first, offsetX, offsetY, emojiStyle);
  }

  for (const seg of segments) {
    if (seg.textDecoration) {
      drawTextDecoration(ctx, seg, offsetX, offsetY);
    }
  }
}

async function drawEmoji(
  ctx: SKRSContext2D,
  emoji: PlacedEmoji[],
  font: TextSegment,
  offsetX: number,
  offsetY: number,
  emojiStyle: EmojiStyle,
): Promise<void> {
  const images = await Promise.all(
    emoji.map((e) => loadEmojiImage(emojiStyle, e.grapheme)),
  );
  emoji.forEach((e, i) => {
    const img = images[i];
    if (img) {
      ctx.drawImage(img, offsetX + e.x, offsetY + e.y, e.size, e.size);
      return;
    }
    // Emoji image unavailable: draw it as text, in its box on the baseline.
    setFont(
      ctx,
      font.fontSize,
      font.fontFamily,
      font.fontWeight,
      font.fontStyle,
    );
    const textRendering = ctx.textRendering;
    ctx.textRendering = "geometricPrecision";
    ctx.fillText(e.grapheme, offsetX + e.x, offsetY + e.baseline);
    ctx.textRendering = textRendering;
  });
}

/** Extract the alpha component from a CSS color string. */
function getColorAlpha(color: string): number {
  const parsed = parseCssColor(color);
  return parsed ? parsed.alpha : 1;
}

/**
 * Draw one text shadow, with the canvas shadow API (see `paintShadow`).
 *
 * CSS text-shadow renders the shadow as if derived from the text's painted
 * appearance, so when the text color has alpha < 1 the shadow is also
 * attenuated: globalAlpha is scaled by the text color's alpha, and the text
 * casting the shadow is drawn opaque.
 */
function drawShadowPass(
  ctx: SKRSContext2D,
  shadow: Shadow,
  textAlpha: number,
  layout: TextLayoutResult,
  x: number,
  y: number,
  drawFn: () => void,
): void {
  ctx.save();
  // The text is drawn opaque, so that its shadow is the shadow colour.
  ctx.fillStyle = "#000";
  if (textAlpha < 1) ctx.globalAlpha *= textAlpha;
  // Where the text paints: its lines, and the text box, which overflowing
  // lines can leave, and glyphs overhang by about their size at most.
  let left = 0;
  let right = layout.width;
  let pad = 0;
  for (const seg of layout.segments) {
    left = Math.min(left, seg.x);
    right = Math.max(right, seg.x + seg.width);
    pad = Math.max(pad, seg.fontSize * 2);
  }
  paintShadow(
    ctx,
    shadow,
    {
      left: x + left - pad,
      top: y - pad,
      right: x + right + pad,
      bottom: y + layout.height + pad,
    },
    drawFn,
  );
  ctx.restore();
}

function drawTextDecoration(
  ctx: SKRSContext2D,
  seg: TextSegment,
  offsetX: number,
  offsetY: number,
): void {
  const decoration = seg.textDecoration;
  if (!decoration || decoration === "none") return;

  ctx.strokeStyle = seg.color;
  ctx.lineWidth = Math.max(1, seg.fontSize * 0.1);

  const x = offsetX + seg.x;
  const baseY = offsetY + seg.y;

  if (decoration.includes("underline")) {
    const y = baseY + seg.ascent * 0.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + seg.width, y);
    ctx.stroke();
  }

  if (decoration.includes("line-through")) {
    const y = baseY - seg.fontSize * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + seg.width, y);
    ctx.stroke();
  }

  if (decoration.includes("overline")) {
    const y = baseY - seg.fontSize * 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + seg.width, y);
    ctx.stroke();
  }
}
