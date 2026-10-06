import { describe, expect, it } from "vitest";
import { isEmoji } from "./language.ts";

const graphemes = (text: string) =>
  [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
  ].map((s) => s.segment);

/** Which of the text's grapheme clusters are emoji. */
const emojiIn = (text: string) => graphemes(text).filter(isEmoji);

describe("isEmoji", () => {
  it.each([
    ["an emoji presentation character", "\u{1F30D}"],
    ["an emoji presentation character in the BMP", "\u2B50"],
    ["a text presentation character with U+FE0F", "\u00A9\uFE0F"],
    ["a symbol with U+FE0F", "\u260E\uFE0F"],
    ["a text-default emoji in the BMP: telephone", "\u260E"],
    ["a text-default emoji in the BMP: heavy check mark", "\u2714"],
    ["a text-default emoji in the BMP: heart", "\u2764"],
    ["a text-default emoji in the BMP: sun", "\u2600"],
    ["a text-default emoji in the BMP: circled ideograph", "\u3299"],
    ["a text-default emoji in the BMP: black square", "\u25AA"],
    ["a skin tone", "\u{1F44D}\u{1F3FD}"],
    ["a skin tone on a text presentation base", "\u261D\u{1F3FD}"],
    ["a skin tone on its own", "\u{1F3FD}"],
    ["a flag", "\u{1F1E7}\u{1F1EA}"],
    ["a regional indicator on its own", "\u{1F1E7}"],
    ["a keycap", "1\uFE0F\u20E3"],
    ["a keycap without U+FE0F", "#\u20E3"],
    [
      "a subdivision flag",
      "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    ],
    ["a ZWJ family", "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}"],
    [
      "a ZWJ sequence with skin tones",
      "\u{1F9D1}\u{1F3FD}\u200D\u{1F91D}\u200D\u{1F9D1}\u{1F3FB}",
    ],
    ["a ZWJ sequence with a gender sign", "\u{1F3C3}\u200D\u2642\uFE0F"],
    ["the rainbow flag", "\u{1F3F3}\uFE0F\u200D\u{1F308}"],
    ["an unqualified rainbow flag", "\u{1F3F3}\u200D\u{1F308}"],
    ["an unqualified eye in a speech bubble", "\u{1F441}\u200D\u{1F5E8}"],
    ["a minimally qualified man running", "\u{1F3C3}\u200D\u2642"],
    ["a text-default emoji outside the BMP: detective", "\u{1F575}"],
    ["a text-default emoji outside the BMP: white flag", "\u{1F3F3}"],
    ["a text-default emoji outside the BMP: A button", "\u{1F170}"],
    ["a code point reserved for emoji", "\u{1FC00}"],
  ])("is true for %s", (_, grapheme) => {
    expect(graphemes(grapheme)).toEqual([grapheme]);
    expect(isEmoji(grapheme)).toBe(true);
  });

  it.each([
    ["a letter", "a"],
    ["a digit", "1"],
    ["a digit with U+FE0F", "1\uFE0F"],
    ["the copyright sign", "\u00A9"],
    ["the registered sign", "\u00AE"],
    ["the trade mark sign", "\u2122"],
    ["a number sign", "#"],
    ["an asterisk", "*"],
    ["a check mark", "\u2713"],
    ["a black circle", "\u25CF"],
    ["an emoji with U+FE0E", "\u231A\uFE0E"],
    ["a text-default emoji with U+FE0E", "\u2764\uFE0E"],
    ["a pictograph with no emoji form", "\u{1F322}"],
    ["a lone ZWJ", "\u200D"],
    ["a lone U+FE0F", "\uFE0F"],
    ["a letter and a ZWJ", "a\u200D"],
  ])("is false for %s", (_, grapheme) => {
    expect(graphemes(grapheme)).toEqual([grapheme]);
    expect(isEmoji(grapheme)).toBe(false);
  });

  it.each([
    ["a ZWJ between letters", "a\u200Db"],
    ["Arabic with a ZWJ", "\u0644\u200D \u0628\u200D\u0628"],
    ["Arabic with a ZWNJ", "\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645"],
    ["Devanagari with a ZWJ", "\u0915\u094D\u200D\u0937"],
    ["Devanagari with a ZWNJ", "\u0915\u094D\u200C\u0937"],
    ["CJK", "\u4E2D\u6587\u3002\u65E5\u672C\u8A9E"],
    ["digits joined by a ZWJ", "1\u200D2"],
  ])("finds no emoji in %s", (_, text) => {
    expect(emojiIn(text)).toEqual([]);
  });

  it("finds each emoji in text, and nothing else", () => {
    const flag = "\u{1F1E7}\u{1F1EA}";
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
    expect(
      emojiIn(`Hi ${flag}! \u00A9 \u00A9\uFE0F \u2713 ${family}\u0644\u200D`),
    ).toEqual([flag, "\u00A9\uFE0F", family]);
  });
});
