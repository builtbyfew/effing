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

/**
 * Check if a character is an emoji.
 */
export function isEmoji(char: string): boolean {
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;

  // Common emoji ranges
  if (cp >= 0x1f600 && cp <= 0x1f64f) return true; // Emoticons
  if (cp >= 0x1f300 && cp <= 0x1f5ff) return true; // Misc Symbols & Pictographs
  if (cp >= 0x1f680 && cp <= 0x1f6ff) return true; // Transport & Map
  if (cp >= 0x1f900 && cp <= 0x1f9ff) return true; // Supplemental Symbols
  if (cp >= 0x2600 && cp <= 0x26ff) return true; // Misc Symbols
  if (cp >= 0x2700 && cp <= 0x27bf) return true; // Dingbats
  if (cp >= 0x2b50 && cp <= 0x2b55) return true; // Misc Symbols & Arrows (star, circle)
  if (cp >= 0x200d && cp <= 0x200d) return true; // Zero Width Joiner
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true; // Variation Selectors
  if (cp >= 0x1fa00 && cp <= 0x1fa6f) return true; // Chess Symbols
  if (cp >= 0x1fa70 && cp <= 0x1faff) return true; // Symbols Extended-A
  if (cp >= 0x231a && cp <= 0x23f3) return true; // Misc Technical (watch, hourglass)
  if (cp >= 0x23e9 && cp <= 0x23fa) return true; // Misc Technical (play, pause)
  if (cp >= 0x25aa && cp <= 0x25fe) return true; // Geometric Shapes
  if (cp >= 0x2934 && cp <= 0x2935) return true; // Arrows
  if (cp >= 0x2b05 && cp <= 0x2b07) return true; // Arrows
  if (cp >= 0x3030 && cp <= 0x3030) return true; // Wavy dash
  if (cp >= 0x303d && cp <= 0x303d) return true; // Part alternation mark
  if (cp >= 0x3297 && cp <= 0x3299) return true; // CJK symbols

  return false;
}
