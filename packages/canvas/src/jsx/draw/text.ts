import { loadImage } from "@napi-rs/canvas";
import type { SKRSContext2D, Image } from "@napi-rs/canvas";

import type { EmojiStyle } from "../emoji.ts";
import { getEmojiCode, loadEmoji } from "../emoji.ts";
import type { TextSegment } from "../text/index.ts";
import { splitTextIntoRuns } from "../text/emoji-split.ts";
import { setFont } from "../text/measure.ts";

const emojiImageCache = new Map<string, Promise<Image | null>>();

function loadEmojiImage(
  style: EmojiStyle,
  char: string,
): Promise<Image | null> {
  const code = getEmojiCode(char);
  const key = style + ":" + code;
  let cached = emojiImageCache.get(key);
  if (!cached) {
    cached = loadEmoji(style, code)
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
 * Draw text segments onto the canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param segments - Positioned text segments from the text layout engine
 * @param offsetX - X offset for the text block
 * @param offsetY - Y offset for the text block
 * @param textShadow - Optional text-shadow CSS value
 * @param emojiStyle - Optional emoji style for rendering emoji as images
 */
export async function drawText(
  ctx: SKRSContext2D,
  segments: TextSegment[],
  offsetX: number,
  offsetY: number,
  textShadow?: string,
  emojiStyle?: EmojiStyle,
): Promise<void> {
  for (const seg of segments) {
    if (!seg.text) continue;

    setFont(ctx, seg.fontSize, seg.fontFamily, seg.fontWeight, seg.fontStyle);
    ctx.fillStyle = seg.color;

    const x = offsetX + seg.x;
    const y = offsetY + seg.y;

    if (emojiStyle) {
      await drawSegmentWithEmoji(ctx, seg, x, y, textShadow, emojiStyle);
    } else if (seg.letterSpacing && seg.letterSpacing !== 0) {
      drawTextWithLetterSpacing(ctx, seg.text, x, y, seg.letterSpacing);
    } else {
      if (textShadow) {
        drawTextShadow(ctx, seg.text, x, y, textShadow);
      }
      ctx.fillText(seg.text, x, y);
    }

    // Text decoration
    if (seg.textDecoration) {
      drawTextDecoration(ctx, seg, offsetX, offsetY);
    }
  }
}

async function drawSegmentWithEmoji(
  ctx: SKRSContext2D,
  seg: TextSegment,
  x: number,
  y: number,
  textShadow: string | undefined,
  emojiStyle: EmojiStyle,
): Promise<void> {
  const letterSpacing = seg.letterSpacing ?? 0;
  const runs = splitTextIntoRuns(
    seg.text,
    (text) => {
      setFont(ctx, seg.fontSize, seg.fontFamily, seg.fontWeight, seg.fontStyle);
      return ctx.measureText(text).width;
    },
    seg.fontSize,
    letterSpacing,
  );

  for (const run of runs) {
    if (run.kind === "text") {
      if (textShadow) {
        drawTextShadow(ctx, run.text, x + run.x, y, textShadow);
      }
      if (letterSpacing !== 0) {
        drawTextWithLetterSpacing(ctx, run.text, x + run.x, y, letterSpacing);
      } else {
        ctx.fillText(run.text, x + run.x, y);
      }
    } else {
      const img = await loadEmojiImage(emojiStyle, run.char);
      if (img) {
        const emojiSize = seg.fontSize;
        // Position emoji so it aligns vertically with text:
        // y is the baseline, ascent goes up from baseline
        const emojiY = y - seg.ascent + (seg.height - seg.fontSize) / 2;
        ctx.drawImage(img, x + run.x, emojiY, emojiSize, emojiSize);
      } else {
        // Emoji image unavailable — fall back to text rendering
        ctx.fillText(run.char, x + run.x, y);
      }
    }
  }
}

function drawTextWithLetterSpacing(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
): void {
  let currentX = x;
  for (const char of text) {
    ctx.fillText(char, currentX, y);
    const metrics = ctx.measureText(char);
    currentX += metrics.width + letterSpacing;
  }
}

function drawTextShadow(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  shadow: string,
): void {
  const parts = shadow.match(
    /(-?\d+(?:\.\d+)?)\s*px?\s+(-?\d+(?:\.\d+)?)\s*px?\s+(-?\d+(?:\.\d+)?)\s*px?\s+(.*)/,
  );
  if (!parts) return;

  ctx.save();
  ctx.shadowOffsetX = parseFloat(parts[1]!);
  ctx.shadowOffsetY = parseFloat(parts[2]!);
  ctx.shadowBlur = parseFloat(parts[3]!);
  ctx.shadowColor = parts[4]!.trim();
  ctx.fillText(text, x, y);
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
