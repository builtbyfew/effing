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
  const shadow = textShadow ? parseShadow(textShadow) : null;
  ctx.fillStyle = first.color;

  // Each pass is a single native call for the whole paragraph.
  if (shadow) {
    drawShadowPass(ctx, shadow, getColorAlpha(first.color), () =>
      fillParagraph(ctx, paragraph, x, y),
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

interface ParsedShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

function parseShadow(shadow: string): ParsedShadow | null {
  const parts = shadow.match(
    /(-?\d+(?:\.\d+)?)\s*(?:px)?\s+(-?\d+(?:\.\d+)?)\s*(?:px)?\s+(-?\d+(?:\.\d+)?)\s*(?:px)?\s+(.*)/,
  );
  if (!parts) return null;
  return {
    offsetX: parseFloat(parts[1]!),
    offsetY: parseFloat(parts[2]!),
    blur: parseFloat(parts[3]!),
    color: parts[4]!.trim(),
  };
}

/** Extract the alpha component from a CSS color string. */
function getColorAlpha(color: string): number {
  const parsed = parseCssColor(color);
  return parsed ? parsed.alpha : 1;
}

/**
 * Draw the text shadow manually instead of using the canvas shadow API.
 *
 * CSS text-shadow renders the shadow as if derived from the text's painted
 * appearance, so when the text color has alpha < 1 the shadow is also
 * attenuated. The canvas shadow API does NOT do this — it always renders
 * the shadow at the full specified opacity. We match CSS behavior by
 * drawing the shadow as a separate fillText at the offset, with
 * globalAlpha scaled by the text color's alpha.
 */
function drawShadowPass(
  ctx: SKRSContext2D,
  shadow: ParsedShadow,
  textAlpha: number,
  drawFn: () => void,
): void {
  ctx.save();
  ctx.fillStyle = shadow.color;
  if (textAlpha < 1) ctx.globalAlpha *= textAlpha;
  if (shadow.blur > 0) ctx.filter = `blur(${shadow.blur / 2}px)`;
  ctx.translate(shadow.offsetX, shadow.offsetY);
  drawFn();
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
