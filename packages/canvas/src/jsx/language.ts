// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

/**
 * Detect the primary script/language of a text string.
 * Used for font selection and line-breaking behavior.
 */
export function detectLanguageCode(text: string): string | undefined {
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;

    // CJK Unified Ideographs
    if (cp >= 0x4e00 && cp <= 0x9fff) return "zh";
    // CJK Extension A
    if (cp >= 0x3400 && cp <= 0x4dbf) return "zh";
    // Hiragana
    if (cp >= 0x3040 && cp <= 0x309f) return "ja";
    // Katakana
    if (cp >= 0x30a0 && cp <= 0x30ff) return "ja";
    // Hangul Syllables
    if (cp >= 0xac00 && cp <= 0xd7af) return "ko";
    // Hangul Jamo
    if (cp >= 0x1100 && cp <= 0x11ff) return "ko";
    // Thai
    if (cp >= 0x0e00 && cp <= 0x0e7f) return "th";
    // Arabic
    if (cp >= 0x0600 && cp <= 0x06ff) return "ar";
    // Hebrew
    if (cp >= 0x0590 && cp <= 0x05ff) return "he";
    // Devanagari
    if (cp >= 0x0900 && cp <= 0x097f) return "hi";
    // Bengali
    if (cp >= 0x0980 && cp <= 0x09ff) return "bn";
    // Tamil
    if (cp >= 0x0b80 && cp <= 0x0bff) return "ta";
    // Telugu
    if (cp >= 0x0c00 && cp <= 0x0c7f) return "te";
    // Kannada
    if (cp >= 0x0c80 && cp <= 0x0cff) return "kn";
    // Malayalam
    if (cp >= 0x0d00 && cp <= 0x0d7f) return "ml";
  }

  return undefined;
}

// What Unicode presents as an emoji (UTS #51), as Chrome draws it. A
// character with an emoji form that is text by default, such as © or ☎, is
// text unless U+FE0F follows it.

/** A character with an emoji form, \p{Emoji} or \p{Extended_Pictographic}. */
const EMOJI_CHAR = String.raw`[\p{Emoji}\p{Extended_Pictographic}]`;

/**
 * A keycap base: a digit, # or *. On its own, even before U+FE0F, it's text,
 * as in Chrome; only a keycap sequence makes it an emoji.
 */
const KEYCAP_BASE = "[0-9#*]";

/** A tag sequence's tags, as in a subdivision flag such as 🏴󠁧󠁢󠁥󠁮󠁧󠁿. */
const TAGS = String.raw`[\u{E0020}-\u{E007E}]+\u{E007F}`;

/** An emoji element presented as an emoji, also when it stands alone. */
const PRESENTED_EMOJI = [
  // Keycap: 1️⃣, and the unqualified 1⃣.
  String.raw`${KEYCAP_BASE}\uFE0F?\u20E3`,
  // Flag: a pair of regional indicators.
  String.raw`\p{Regional_Indicator}{2}`,
  // Emoji presentation sequence (©️), modifier sequence (👍🏽, ☝🏽) or tag
  // sequence (🏴󠁧󠁢󠁥󠁮󠁧󠁿).
  String.raw`(?!${KEYCAP_BASE})${EMOJI_CHAR}(?:\uFE0F|\p{Emoji_Modifier}|${TAGS})`,
  // Emoji presentation by default (🌍, ⭐).
  String.raw`\p{Emoji_Presentation}`,
  // A code point reserved for emoji that this runtime's Unicode doesn't know
  // yet: every emoji added since Unicode 9 is presented as one by default.
  String.raw`(?=\p{Cn})\p{Extended_Pictographic}`,
].join("|");

/**
 * An element of a ZWJ sequence: any emoji element, presented as one or not
 * (the 🏳 in a minimally qualified 🏳‍🌈), but no bare keycap base.
 */
const ZWJ_ELEMENT = `(?:${PRESENTED_EMOJI}|(?!${KEYCAP_BASE})${EMOJI_CHAR})`;

const EMOJI_RE = new RegExp(
  `^(?:${PRESENTED_EMOJI}|${ZWJ_ELEMENT}(?:\\u200D${ZWJ_ELEMENT})+)$`,
  "u",
);

/**
 * Whether a grapheme cluster is an emoji, as Unicode defines one (UTS #51):
 * an emoji presentation character, an emoji character followed by U+FE0F, a
 * keycap, a flag, a modifier or tag sequence, or a ZWJ sequence of emoji. A
 * ZWJ between anything else (the joiner in Arabic or Indic text, or a lone
 * one) doesn't make an emoji, and neither do symbols that Unicode presents as
 * text by default, such as ©, ✓, ● or ☎.
 *
 * @param grapheme - One grapheme cluster, as `Intl.Segmenter` splits text
 */
export function isEmoji(grapheme: string): boolean {
  return EMOJI_RE.test(grapheme);
}
