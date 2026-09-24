// Native paragraph layout through the @effing/skia `Paragraph` primitive:
// Skia breaks, shapes and paints the text in one place, instead of measuring
// word by word across the native boundary. Enabled with EFFING_NATIVE_TEXT=1
// when the loaded @napi-rs/canvas build provides `Paragraph`.

import * as napiCanvas from "@napi-rs/canvas";

import type { ComputedStyle } from "../style/compute.ts";
import { DEFAULT_FONT_FAMILY } from "../style/compute.ts";
import { isEmoji } from "../language.ts";
import type { FontMetrics } from "../font-metrics.ts";
import { measureTrimMetrics } from "./measure.ts";
import type { TextLayoutResult, TextSegment } from "./index.ts";

export type NativeParagraphStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: "left" | "right" | "center" | "justify";
  noWrap?: boolean;
  maxLines?: number;
  ellipsis?: string;
};

export type NativeParagraphLine = {
  left: number;
  width: number;
  baseline: number;
  ascent: number;
  descent: number;
  height: number;
  startIndex: number;
  endIndex: number;
  hardBreak: boolean;
};

export type NativeParagraphLayout = {
  height: number;
  longestLine: number;
  minIntrinsicWidth: number;
  maxIntrinsicWidth: number;
  didExceedMaxLines: boolean;
  lineHeight: number;
  ascent: number;
  descent: number;
  lines: NativeParagraphLine[];
};

export interface NativeParagraph {
  layout(width: number): NativeParagraphLayout;
}

type ParagraphConstructor = new (
  text: string,
  style: NativeParagraphStyle,
) => NativeParagraph;

let ParagraphCtor: ParagraphConstructor | undefined;

export function nativeTextEnabled(): boolean {
  if (process.env.EFFING_NATIVE_TEXT !== "1") return false;
  if (ParagraphCtor === undefined) {
    try {
      ParagraphCtor = (napiCanvas as { Paragraph?: ParagraphConstructor })
        .Paragraph;
    } catch {
      // A module mock without the export throws on access.
      return false;
    }
  }
  return ParagraphCtor !== undefined;
}

/**
 * Whether the native path covers this text. `word-break: break-all` has no
 * Skia equivalent, and emoji drawn as images need per-emoji placement.
 */
export function canLayoutNatively(
  text: string,
  style: ComputedStyle,
  emojiEnabled?: boolean,
): boolean {
  if (style.wordBreak === "break-all") return false;
  if (emojiEnabled) {
    for (const char of text) {
      if (isEmoji(char)) return false;
    }
  }
  return true;
}

function toWeight(weight: number | string | undefined): number {
  if (typeof weight === "number") return weight;
  if (weight === "bold") return 700;
  const parsed = parseInt(String(weight ?? "400"), 10);
  return isNaN(parsed) ? 400 : parsed;
}

// Paragraphs are shaped once per text and style; Yoga measures the same node
// at several widths, and drawing lays it out once more.
const MAX_CACHED = 512;
const paragraphCache = new Map<string, NativeParagraph>();

/** Drop shaped paragraphs, e.g. after a font was registered. */
export function clearNativeParagraphCache(): void {
  paragraphCache.clear();
}

function getParagraph(
  text: string,
  style: NativeParagraphStyle,
): NativeParagraph {
  const key = JSON.stringify([text, style]);
  let paragraph = paragraphCache.get(key);
  if (paragraph) {
    paragraphCache.delete(key);
  } else {
    paragraph = new ParagraphCtor!(text, style);
    if (paragraphCache.size >= MAX_CACHED) {
      paragraphCache.delete(paragraphCache.keys().next().value!);
    }
  }
  paragraphCache.set(key, paragraph);
  return paragraph;
}

/**
 * Lay out already-transformed text natively. Mirrors `layoutText`: one
 * segment per line, CSS half-leading line boxes from the font's hhea metrics,
 * ellipsis for nowrap + text-overflow and for line-clamp, and text-box-trim.
 */
export function layoutTextNative(
  text: string,
  style: ComputedStyle,
  maxWidth: number,
  lineHeight: number | undefined,
): TextLayoutResult {
  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle ?? "normal";
  const letterSpacing =
    typeof style.letterSpacing === "number" ? style.letterSpacing : 0;
  const whiteSpace = style.whiteSpace ?? "normal";
  const noWrap = whiteSpace === "nowrap" || whiteSpace === "pre";
  const lineClamp =
    style.lineClamp && style.lineClamp > 0 ? style.lineClamp : undefined;
  const ellipsis =
    lineClamp !== undefined || (noWrap && style.textOverflow === "ellipsis")
      ? "…"
      : undefined;

  const paragraph = getParagraph(text, {
    fontFamily,
    fontSize,
    fontWeight: toWeight(fontWeight),
    fontStyle,
    letterSpacing,
    lineHeight: lineHeight ?? 0,
    textAlign: style.textAlign ?? "left",
    noWrap,
    maxLines: lineClamp,
    ellipsis,
  });
  const layout = paragraph.layout(maxWidth);

  const utf8 = Buffer.from(text);
  const segments: TextSegment[] = layout.lines.map((line, i) => ({
    text: utf8.subarray(line.startIndex, line.endIndex).toString(),
    x: line.left,
    y: line.baseline,
    width: line.width,
    height: line.height,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    color: style.color ?? "black",
    ascent: line.ascent,
    textDecoration: style.textDecoration,
    letterSpacing,
    lineIndex: i,
  }));

  let height = layout.height;
  // As in layoutText: round auto line-height boxes up so Yoga's integer
  // rounding never clips a descender.
  if (lineHeight === undefined && segments.length > 0) {
    height = Math.ceil(height);
  }

  let paragraphOffsetY = 0;
  const textBoxTrim = style.textBoxTrim;
  if (textBoxTrim && textBoxTrim !== "none" && segments.length > 0) {
    // Express the hhea metrics as a font of unitsPerEm = fontSize, so they
    // convert back to the same px.
    const fontMetrics: FontMetrics = {
      unitsPerEm: fontSize,
      ascender: layout.ascent,
      descender: -layout.descent,
    };
    const trim = measureTrimMetrics(
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      layout.lineHeight,
      style.textBoxEdge ?? "text",
      undefined,
      fontMetrics,
    );
    if (textBoxTrim === "trim-start" || textBoxTrim === "trim-both") {
      for (const seg of segments) seg.y -= trim.overTrim;
      height -= trim.overTrim;
      paragraphOffsetY = -trim.overTrim;
    }
    if (textBoxTrim === "trim-end" || textBoxTrim === "trim-both") {
      height -= trim.underTrim;
    }
  }

  return {
    segments,
    width: segments.reduce((w, s) => Math.max(w, s.width), 0),
    height,
    paragraph,
    paragraphOffsetY,
  };
}
