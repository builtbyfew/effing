// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import { UNASSIGNED_PICTOGRAPHIC } from "./language.ts";

/**
 * Emoji style options for rendering
 */
export type EmojiStyle =
  "twemoji" | "openmoji" | "blobmoji" | "noto" | "fluent" | "fluentFlat";

const FE0F = 0xfe0f;
const ZWJ = 0x200d;
const KEYCAP = 0x20e3;

const EMOJI_CHAR = /[\p{Emoji}\p{Extended_Pictographic}]/u;
// Presented as an emoji without U+FE0F: by default, or (unassigned in this
// runtime's Unicode) as every emoji added since Unicode 9 is.
const EMOJI_PRESENTATION = new RegExp(
  String.raw`\p{Emoji_Presentation}|${UNASSIGNED_PICTOGRAPHIC}`,
  "u",
);
const EMOJI_MODIFIER = /\p{Emoji_Modifier}/u;

/**
 * An emoji's code points in its fully-qualified form (UTS #51), which names
 * its image in every style: U+FE0F after each element that is text by default
 * (©️, the ♂️ in 🏃‍♂️, the 🏳️ in 🏳️‍🌈, the 1️ in 1️⃣), unless an emoji modifier
 * follows it (☝🏽).
 */
function qualifiedCodePoints(emoji: string): number[] {
  const chars = [...emoji].filter((c) => c.codePointAt(0) !== FE0F);
  const codePoints: number[] = [];
  chars.forEach((char, i) => {
    codePoints.push(char.codePointAt(0)!);
    const startsElement = i === 0 || chars[i - 1] === "\u200D";
    if (
      startsElement &&
      EMOJI_CHAR.test(char) &&
      !EMOJI_PRESENTATION.test(char) &&
      !EMOJI_MODIFIER.test(chars[i + 1] ?? "")
    ) {
      codePoints.push(FE0F);
    }
  });
  return codePoints;
}

function hex(codePoints: number[], pad = 0): string {
  return codePoints.map((cp) => cp.toString(16).padStart(pad, "0")).join("-");
}

/**
 * Twemoji's file name: lowercase hex code points, with U+FE0F dropped unless
 * the emoji is a ZWJ sequence (its own `grabTheRightIcon` rule), and from
 * 👁️‍🗨️, the one ZWJ sequence it names without them.
 */
function twemojiCode(codePoints: number[]): string {
  const code = hex(
    codePoints.includes(ZWJ)
      ? codePoints
      : codePoints.filter((cp) => cp !== FE0F),
  );
  return code === "1f441-fe0f-200d-1f5e8-fe0f" ? "1f441-200d-1f5e8" : code;
}

/**
 * Svgmoji's file name (OpenMoji, Blobmoji and Noto): Emojibase hexcodes,
 * uppercase and padded to four digits, with U+FE0F kept only in ZWJ and
 * keycap sequences.
 */
function svgmojiCode(codePoints: number[]): string {
  const keepFE0F = codePoints.includes(ZWJ) || codePoints.includes(KEYCAP);
  return hex(
    keepFE0F ? codePoints : codePoints.filter((cp) => cp !== FE0F),
    4,
  ).toUpperCase();
}

/**
 * Fluent's file name: the fully-qualified emoji itself. Its hex names are
 * inconsistent about U+FE0F (`1f590-fe0f`, but `2764-200d-1f525`), so they
 * miss emoji that the glyph names cover.
 */
function fluentCode(codePoints: number[]): string {
  return encodeURIComponent(String.fromCodePoint(...codePoints));
}

const emojiUrls: Record<EmojiStyle, (codePoints: number[]) => string> = {
  twemoji: (cps) =>
    `https://cdnjs.cloudflare.com/ajax/libs/twemoji/16.0.1/svg/${twemojiCode(cps)}.svg`,
  openmoji: (cps) =>
    `https://cdn.jsdelivr.net/npm/@svgmoji/openmoji@2.0.0/svg/${svgmojiCode(cps)}.svg`,
  blobmoji: (cps) =>
    `https://cdn.jsdelivr.net/npm/@svgmoji/blob@2.0.0/svg/${svgmojiCode(cps)}.svg`,
  noto: (cps) =>
    `https://cdn.jsdelivr.net/gh/svgmoji/svgmoji/packages/svgmoji__noto/svg/${svgmojiCode(cps)}.svg`,
  fluent: (cps) =>
    `https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${fluentCode(cps)}_color.svg`,
  fluentFlat: (cps) =>
    `https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${fluentCode(cps)}_flat.svg`,
};

/**
 * The URL of an emoji's SVG image in a style. The emoji may be fully,
 * minimally or not qualified (🏳️‍🌈, or the unqualified 🏳‍🌈): each style names its images
 * after the fully-qualified form, in its own way.
 *
 * @param style - The emoji style
 * @param emoji - One emoji grapheme cluster
 */
export function emojiUrl(style: EmojiStyle, emoji: string): string {
  return emojiUrls[style](qualifiedCodePoints(emoji));
}

const emojiCache: Record<string, Promise<string>> = {};

/**
 * Fetch an emoji's SVG image in a style, once per URL.
 *
 * @param style - The emoji style
 * @param emoji - One emoji grapheme cluster
 */
export async function loadEmoji(
  style: EmojiStyle,
  emoji: string,
): Promise<string> {
  const url = emojiUrl(style, emoji);
  return (emojiCache[url] ??= fetch(url).then((r) => r.text()));
}
