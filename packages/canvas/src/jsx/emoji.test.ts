import { describe, expect, it } from "vitest";
import { emojiUrl } from "./emoji.ts";
import type { EmojiStyle } from "./emoji.ts";

/** The file an emoji's image is named by, less its suffix. */
const file = (style: EmojiStyle, emoji: string) =>
  decodeURIComponent(emojiUrl(style, emoji).split("/").pop()!).replace(
    /(_color|_flat)?\.svg$/,
    "",
  );

const FLAG = "\u{1F1E7}\u{1F1EA}";
const KEYCAP = "1\uFE0F\u20E3";
const ENGLAND =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const THUMBS_UP_TONE = "\u{1F44D}\u{1F3FD}";
const RAINBOW = "\u{1F3F3}\uFE0F\u200D\u{1F308}";
const RUNNER_TONE_MALE = "\u{1F3C3}\u{1F3FD}\u200D\u2642\uFE0F";

describe("emojiUrl", () => {
  it("names twemoji's images by lowercase code points, without U+FE0F outside ZWJ sequences", () => {
    expect(emojiUrl("twemoji", "\u{1F30D}")).toBe(
      "https://cdnjs.cloudflare.com/ajax/libs/twemoji/16.0.1/svg/1f30d.svg",
    );
    expect(file("twemoji", FLAG)).toBe("1f1e7-1f1ea");
    expect(file("twemoji", KEYCAP)).toBe("31-20e3");
    expect(file("twemoji", ENGLAND)).toBe(
      "1f3f4-e0067-e0062-e0065-e006e-e0067-e007f",
    );
    expect(file("twemoji", THUMBS_UP_TONE)).toBe("1f44d-1f3fd");
    expect(file("twemoji", "\u00A9\uFE0F")).toBe("a9");
    expect(file("twemoji", RAINBOW)).toBe("1f3f3-fe0f-200d-1f308");
    expect(file("twemoji", RUNNER_TONE_MALE)).toBe(
      "1f3c3-1f3fd-200d-2642-fe0f",
    );
    // Twemoji's one ZWJ sequence named without its U+FE0Fs.
    expect(file("twemoji", "\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F")).toBe(
      "1f441-200d-1f5e8",
    );
  });

  it.each(["openmoji", "blobmoji", "noto"] as const)(
    "names %s's images by Emojibase hexcodes",
    (style) => {
      expect(file(style, "\u{1F30D}")).toBe("1F30D");
      expect(file(style, FLAG)).toBe("1F1E7-1F1EA");
      // Padded to four digits, with U+FE0F in keycaps.
      expect(file(style, KEYCAP)).toBe("0031-FE0F-20E3");
      expect(file(style, "\u00A9\uFE0F")).toBe("00A9");
      expect(file(style, ENGLAND)).toBe(
        "1F3F4-E0067-E0062-E0065-E006E-E0067-E007F",
      );
      expect(file(style, THUMBS_UP_TONE)).toBe("1F44D-1F3FD");
      expect(file(style, RAINBOW)).toBe("1F3F3-FE0F-200D-1F308");
    },
  );

  it.each(["fluent", "fluentFlat"] as const)(
    "names %s's images by the fully-qualified emoji",
    (style) => {
      expect(emojiUrl(style, "\u{1F30D}")).toMatch(
        /\/assets\/%F0%9F%8C%8D_(color|flat)\.svg$/,
      );
      expect(file(style, KEYCAP)).toBe(KEYCAP);
      expect(file(style, "\u00A9")).toBe("\u00A9\uFE0F");
      expect(file(style, RUNNER_TONE_MALE)).toBe(RUNNER_TONE_MALE);
    },
  );

  it("qualifies an emoji before naming it", () => {
    // U+FE0F after each element that's text by default, unless a skin tone
    // follows it.
    expect(file("twemoji", "\u{1F3F3}\u200D\u{1F308}")).toBe(
      "1f3f3-fe0f-200d-1f308",
    );
    expect(file("twemoji", "\u{1F3C3}\u200D\u2642")).toBe(
      "1f3c3-200d-2642-fe0f",
    );
    expect(file("twemoji", "\u261D\u{1F3FD}")).toBe("261d-1f3fd");
    expect(file("openmoji", "1\u20E3")).toBe("0031-FE0F-20E3");
    expect(file("fluent", "\u{1F3F3}\u200D\u{1F308}")).toBe(RAINBOW);
  });
});
