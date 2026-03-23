import { loadImage } from "@napi-rs/canvas";
import type { SKRSContext2D, Image } from "@napi-rs/canvas";

import parseCssColor from "parse-css-color";

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
  const shadow = textShadow ? parseShadow(textShadow) : null;

  for (const seg of segments) {
    if (!seg.text) continue;

    setFont(ctx, seg.fontSize, seg.fontFamily, seg.fontWeight, seg.fontStyle);
    ctx.fillStyle = seg.color;

    const x = offsetX + seg.x;
    const y = offsetY + seg.y;
    const textAlpha = shadow ? getColorAlpha(seg.color) : 1;

    const hasStroke =
      seg.textStrokeWidth !== undefined && seg.textStrokeWidth > 0;

    if (emojiStyle) {
      await drawSegmentWithEmoji(
        ctx,
        seg,
        x,
        y,
        textShadow,
        emojiStyle,
        hasStroke,
      );
    } else if (seg.letterSpacing && seg.letterSpacing !== 0) {
      if (shadow) {
        drawShadowPass(ctx, shadow, textAlpha, () =>
          drawTextWithLetterSpacing(ctx, seg.text, x, y, seg.letterSpacing),
        );
      }
      if (hasStroke) {
        drawStrokeWithLetterSpacing(
          ctx,
          seg.text,
          x,
          y,
          seg.letterSpacing,
          seg.textStrokeWidth!,
          seg.textStrokeColor ?? seg.color,
        );
      }
      drawTextWithLetterSpacing(ctx, seg.text, x, y, seg.letterSpacing);
    } else {
      if (shadow) {
        drawShadowPass(ctx, shadow, textAlpha, () =>
          ctx.fillText(seg.text, x, y),
        );
      }
      if (hasStroke) {
        ctx.save();
        ctx.lineWidth = seg.textStrokeWidth!;
        ctx.strokeStyle = seg.textStrokeColor ?? seg.color;
        ctx.lineJoin = "round";
        ctx.strokeText(seg.text, x, y);
        ctx.restore();
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
  hasStroke?: boolean,
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

  const shadow = textShadow ? parseShadow(textShadow) : null;
  const textAlpha = shadow ? getColorAlpha(seg.color) : 1;

  for (const run of runs) {
    if (run.kind === "text") {
      if (shadow) {
        if (letterSpacing !== 0) {
          drawShadowPass(ctx, shadow, textAlpha, () =>
            drawTextWithLetterSpacing(
              ctx,
              run.text,
              x + run.x,
              y,
              letterSpacing,
            ),
          );
        } else {
          drawShadowPass(ctx, shadow, textAlpha, () =>
            ctx.fillText(run.text, x + run.x, y),
          );
        }
      }
      if (hasStroke) {
        if (letterSpacing !== 0) {
          drawStrokeWithLetterSpacing(
            ctx,
            run.text,
            x + run.x,
            y,
            letterSpacing,
            seg.textStrokeWidth!,
            seg.textStrokeColor ?? seg.color,
          );
        } else {
          ctx.save();
          ctx.lineWidth = seg.textStrokeWidth!;
          ctx.strokeStyle = seg.textStrokeColor ?? seg.color;
          ctx.lineJoin = "round";
          ctx.strokeText(run.text, x + run.x, y);
          ctx.restore();
        }
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

function drawStrokeWithLetterSpacing(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  strokeWidth: number,
  strokeColor: string,
): void {
  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.lineJoin = "round";
  let currentX = x;
  for (const char of text) {
    ctx.strokeText(char, currentX, y);
    const metrics = ctx.measureText(char);
    currentX += metrics.width + letterSpacing;
  }
  ctx.restore();
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
