import { describe, expect, it, vi } from "vitest";

vi.mock("@effing/skia", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("@effing/skia/extensions", async () => {
  const { createExtensionsMock } = await import("../../canvas-mock.ts");
  return createExtensionsMock();
});

import { layoutText } from "./index.ts";
import { releaseParagraphs } from "./native.ts";

/** The style the mock paragraph was built with. */
const paragraphStyle = (result: ReturnType<typeof layoutText>) =>
  (result.paragraph as unknown as { style: Record<string, unknown> }).style;

// The mocks measure 8px per character, with ascent 12 and descent 4.

describe("layoutText", () => {
  it("lays text out natively, one segment per line", () => {
    const result = layoutText(
      "aaa bbb ccc",
      { fontSize: 16, color: "red", lineHeight: 20 },
      56,
    );
    expect(result.paragraph).toBeDefined();
    expect(result.segments.map((s) => s.text)).toEqual(["aaa bbb", "ccc"]);
    expect(result.segments.map((s) => s.y)).toEqual([14, 34]);
    expect(result.segments[0]).toMatchObject({
      x: 0,
      width: 56,
      height: 20,
      ascent: 12,
      color: "red",
      lineIndex: 0,
    });
    expect(result.width).toBe(56);
    expect(result.height).toBe(40);
  });

  it("applies text transform before laying out", () => {
    const result = layoutText(
      "hello",
      { fontSize: 16, textTransform: "uppercase" },
      500,
    );
    expect(result.paragraph).toBeDefined();
    expect(result.segments[0]!.text).toBe("HELLO");
  });

  it("aligns lines within the box", () => {
    const result = layoutText(
      "aaa",
      { fontSize: 16, textAlign: "center" },
      100,
    );
    expect(result.segments[0]!.x).toBe(38);
  });

  it("clamps lines, the last one ending in an ellipsis", () => {
    const result = layoutText(
      "aaa bbb ccc ddd eee fff",
      { fontSize: 16, lineClamp: 2 },
      56,
    );
    expect(result.segments).toHaveLength(2);
    // The ellipsis is part of the line's width, not of its text.
    expect(result.segments[1]!.text).toBe("ccc dd");
    expect(result.segments[1]!.width).toBe(56);
  });

  it("truncates nowrap text with text-overflow: ellipsis", () => {
    const style = { fontSize: 16, whiteSpace: "nowrap" } as const;
    expect(layoutText("aaa bbb ccc", style, 56).width).toBe(88);
    expect(
      layoutText("aaa bbb ccc", { ...style, textOverflow: "ellipsis" }, 56)
        .width,
    ).toBe(56);
  });

  it("carries the text stroke to every segment", () => {
    const result = layoutText(
      "aaa bbb ccc",
      {
        fontSize: 16,
        WebkitTextStrokeWidth: 2,
        WebkitTextStrokeColor: "blue",
      },
      56,
    );
    for (const seg of result.segments) {
      expect(seg.textStrokeWidth).toBe(2);
      expect(seg.textStrokeColor).toBe("blue");
    }
  });

  it("shifts the paragraph up by what text-box-trim removes from the top", () => {
    // Line height 32 over a 16px content area: 8px of half-leading each side.
    const style = { fontSize: 16, lineHeight: 32 } as const;
    const untrimmed = layoutText("aaa", style, 500);
    const trimmed = layoutText(
      "aaa",
      { ...style, textBoxTrim: "trim-both", textBoxEdge: "text" },
      500,
    );
    expect(untrimmed.paragraphOffsetY).toBe(0);
    expect(trimmed.paragraphOffsetY).toBe(-8);
    expect(trimmed.segments[0]!.y).toBe(untrimmed.segments[0]!.y - 8);
    expect(trimmed.height).toBe(untrimmed.height - 16);
  });

  it.each([
    ["normal", {}, "normal", "normal"],
    ["break-all", { wordBreak: "break-all" }, "break-all", "normal"],
    ["keep-all", { wordBreak: "keep-all" }, "keep-all", "normal"],
    [
      "word-break: break-word",
      { wordBreak: "break-word" },
      "normal",
      "break-word",
    ],
    [
      "overflow-wrap: break-word",
      { overflowWrap: "break-word" },
      "normal",
      "break-word",
    ],
    [
      "overflow-wrap: anywhere",
      { overflowWrap: "anywhere" },
      "normal",
      "break-word",
    ],
  ] as const)(
    "breaks words as CSS %s does",
    (_, style, wordBreak, overflowWrap) => {
      const result = layoutText("aaa bbb", { fontSize: 16, ...style }, 500);
      expect(paragraphStyle(result)).toMatchObject({ wordBreak, overflowWrap });
    },
  );

  it("leaves a word wider than the box to overflow it", () => {
    const result = layoutText("aaa bbbbbbbbbb ccc", { fontSize: 16 }, 56);
    expect(result.segments.map((s) => s.text)).toEqual([
      "aaa",
      "bbbbbbbbbb",
      "ccc",
    ]);
    expect(result.segments[1]!.width).toBe(80);
    expect(result.width).toBe(80);
  });

  it("collapses the line boxes for a line height of 0", () => {
    const result = layoutText(
      "aaa bbb ccc",
      { fontSize: 16, lineHeight: 0 },
      56,
    );
    expect(paragraphStyle(result).lineHeight).toBe(0);
    expect(result.segments).toHaveLength(2);
    expect(result.height).toBe(0);
  });

  it("leaves `normal` line height to the paragraph", () => {
    for (const lineHeight of [undefined, "normal"]) {
      const result = layoutText("aaa", { fontSize: 16, lineHeight }, 500);
      expect(paragraphStyle(result).lineHeight).toBeUndefined();
    }
  });

  it("keeps the trailing spaces of white-space: pre and pre-wrap in the line", () => {
    for (const whiteSpace of ["pre", "pre-wrap"] as const) {
      // The three trailing spaces are part of the line: 8 characters of 8px.
      const padded = layoutText("Hello   ", { fontSize: 16, whiteSpace }, 500);
      expect(padded.width).toBe(64);
    }
    expect(
      layoutText("Hello   ", { fontSize: 16, whiteSpace: "pre-line" }, 500)
        .width,
    ).toBe(40);
  });

  it.each(["center", "right"] as const)(
    "start-aligns a %s-aligned line that overflows its box",
    (textAlign) => {
      const style = { fontSize: 16, whiteSpace: "nowrap", textAlign } as const;
      // 11 characters of 8px in a 56px box.
      expect(layoutText("aaa bbb ccc", style, 56).segments[0]!.x).toBe(0);
      // A line that fits is still aligned.
      expect(layoutText("aaa", style, 56).segments[0]!.x).toBe(
        textAlign === "center" ? 16 : 32,
      );
    },
  );

  it("keeps one empty line box for empty text", () => {
    for (const [lineHeight, y, height] of [
      [20, 14, 20],
      // `normal`: the mock's 16px line, rounded up.
      [undefined, 12, 16],
    ]) {
      const result = layoutText("", { fontSize: 16, lineHeight }, 500);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toMatchObject({
        text: "",
        x: 0,
        width: 0,
        y,
        height: lineHeight ?? 16,
      });
      expect(result.height).toBe(height);
    }
  });

  describe("with emoji drawn as images", () => {
    it("leaves each emoji an inline box of a square em", () => {
      const result = layoutText(
        "aa \u{1F30D} bb",
        { fontSize: 16, lineHeight: 20 },
        500,
        true,
      );
      // "aa " is 24px; the box's bottom is 0.1em below the baseline.
      expect(result.emoji).toHaveLength(1);
      const [emoji] = result.emoji;
      expect(emoji).toMatchObject({
        grapheme: "\u{1F30D}",
        x: 24,
        size: 16,
        baseline: 14,
      });
      expect(emoji!.y).toBeCloseTo(14 + 1.6 - 16, 6);
      expect(result.segments[0]!.text).toBe("aa \u{1F30D} bb");
      expect(result.width).toBe(6 * 8 + 16);
    });

    it("keeps an emoji's grapheme cluster whole", () => {
      const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
      const result = layoutText(`a${family}b`, { fontSize: 16 }, 500, true);
      expect(result.emoji.map((e) => e.grapheme)).toEqual([family]);
      expect(result.segments[0]!.text).toBe(`a${family}b`);
    });

    it.each([
      ["a flag", "\u{1F1E7}\u{1F1EA}"],
      ["a text-default emoji outside the BMP", "\u{1F575}"],
      ["the white flag, without U+FE0F", "\u{1F3F3}"],
      ["a heart, without U+FE0F", "\u2764"],
    ])("leaves %s a box of its own", (_, emoji) => {
      const result = layoutText(`a${emoji}b`, { fontSize: 16 }, 500, true);
      expect(result.emoji.map((e) => [e.grapheme, e.x])).toEqual([[emoji, 8]]);
      expect(result.width).toBe(2 * 8 + 16);
    });

    it.each([
      ["a ZWJ between letters", "a\u200Db"],
      ["Arabic joined by a ZWJ", "\u0644\u200D \u0628\u200D\u0628"],
      ["Devanagari with a ZWJ", "\u0915\u094D\u200D\u0937"],
      ["symbols drawn as text", "\u00A9 \u00AE \u2122 \u2713 \u25CF 1 #"],
    ])("lays %s out as text", (_, text) => {
      const result = layoutText(text, { fontSize: 16 }, 500, true);
      expect(result.emoji).toEqual([]);
      expect(result.width).toBe(text.length * 8);
    });

    it("maps each line back to its text across emoji", () => {
      const result = layoutText(
        "aa\u{1F30D} bb\u{1F389}\u{1F389} cc",
        { fontSize: 16 },
        40,
        true,
      );
      expect(result.segments.map((s) => s.text)).toEqual([
        "aa\u{1F30D}",
        "bb\u{1F389}\u{1F389}",
        "cc",
      ]);
      expect(result.emoji.map((e) => [e.x, e.baseline])).toEqual([
        [16, 12],
        [16, 28],
        [32, 28],
      ]);
    });

    it("adds letter spacing after an emoji, as after any character", () => {
      const result = layoutText(
        "\u{1F30D}a",
        { fontSize: 16, letterSpacing: 2 },
        500,
        true,
      );
      expect(result.width).toBe(18 + 10);
    });

    it("leaves out an emoji that line-clamp cuts off", () => {
      const result = layoutText(
        "aaa bbb \u{1F30D}",
        { fontSize: 16, lineClamp: 1 },
        56,
        true,
      );
      expect(result.emoji).toEqual([]);
    });

    it("lays emoji out as text when they're not drawn as images", () => {
      const result = layoutText("aa \u{1F30D}", { fontSize: 16 }, 500);
      expect(result.emoji).toEqual([]);
      expect(result.segments[0]!.text).toBe("aa \u{1F30D}");
    });
  });
});

describe("releaseParagraphs", () => {
  const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
  // Whether the event loop turned while `fn` ran.
  const turnsDuring = async (fn: () => Promise<void>) => {
    let turned = false;
    setImmediate(() => {
      turned = true;
    });
    await fn();
    return turned;
  };
  const layOut = (count: number) => {
    for (let i = 0; i < count; i++) layoutText("aaa", { fontSize: 16 }, 500);
  };

  it("returns at once while few paragraphs have been built since the last turn", async () => {
    await turn();
    layOut(100);
    expect(await turnsDuring(releaseParagraphs)).toBe(false);
  });

  it("yields a turn of the event loop once many have piled up", async () => {
    await turn();
    layOut(2000);
    expect(await turnsDuring(releaseParagraphs)).toBe(true);
    // The turn released them: nothing is outstanding now.
    expect(await turnsDuring(releaseParagraphs)).toBe(false);
  });
});
