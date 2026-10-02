import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@effing/skia", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("@effing/skia/extensions", async () => {
  const { createExtensionsMock } = await import("../../canvas-mock.ts");
  return createExtensionsMock();
});

vi.mock("../font.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../font.ts")>();
  return {
    ...original,
    getFontMetrics: vi.fn(() => null),
  };
});

import { createCanvas } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";
import { getFontMetrics } from "../font.ts";
import { layoutText, layoutTextFallback } from "./index.ts";

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
    ["word-break: break-all", { wordBreak: "break-all" } as const, false],
    ["emoji drawn as images", {}, true],
  ])("falls back to the TypeScript layout for %s", (_, style, emojiEnabled) => {
    const result = layoutText(
      "aaa \u{1F30D} bbb",
      { fontSize: 16, ...style },
      500,
      undefined,
      emojiEnabled,
    );
    expect(result.paragraph).toBeUndefined();
    expect(result.segments).toHaveLength(1);
  });

  it("falls back for a word wider than the box, which overflows unbroken", () => {
    const result = layoutText("aaa bbbbbbbbbb ccc", { fontSize: 16 }, 56);
    expect(result.paragraph).toBeUndefined();
    expect(result.segments.map((s) => s.text)).toEqual([
      "aaa",
      "bbbbbbbbbb",
      "ccc",
    ]);
  });

  it("falls back for a line height of 0, which a paragraph reads as normal", () => {
    const result = layoutText(
      "aaa bbb ccc",
      { fontSize: 16, lineHeight: 0 },
      56,
    );
    expect(result.paragraph).toBeUndefined();
    expect(result.segments).toHaveLength(2);
    expect(result.height).toBe(0);
  });

  it("falls back for trailing spaces that white-space: pre preserves", () => {
    const pre = { fontSize: 16, whiteSpace: "pre" } as const;
    // The three trailing spaces are part of the line: 8 characters of 8px.
    const padded = layoutText("Hello   ", pre, 500);
    expect(padded.paragraph).toBeUndefined();
    expect(padded.width).toBe(64);
    // Without them there is nothing a paragraph would drop.
    expect(layoutText("Hello", pre, 500).paragraph).toBeDefined();
    expect(layoutText("a  b\nc", pre, 500).paragraph).toBeDefined();
    expect(layoutText("a \nc", pre, 500).paragraph).toBeUndefined();
  });

  it.each(["center", "right"] as const)(
    "start-aligns a %s-aligned line that overflows its box, on both paths",
    (textAlign) => {
      const style = { fontSize: 16, whiteSpace: "nowrap", textAlign } as const;
      // 11 characters of 8px in a 56px box.
      const native = layoutText("aaa bbb ccc", style, 56);
      expect(native.paragraph).toBeDefined();
      expect(native.segments[0]!.x).toBe(0);
      const fallback = layoutTextFallback("aaa bbb ccc", style, 56);
      expect(fallback.segments[0]!.x).toBe(0);
      // A line that fits is still aligned.
      expect(layoutTextFallback("aaa", style, 56).segments[0]!.x).toBe(
        textAlign === "center" ? 16 : 32,
      );
    },
  );

  it("falls back for empty text, which keeps one empty line box", () => {
    const result = layoutText("", { fontSize: 16, lineHeight: 20 }, 500);
    expect(result.paragraph).toBeUndefined();
    expect(result.segments).toHaveLength(1);
    expect(result.height).toBe(20);
  });
});

describe("layoutTextFallback", () => {
  let ctx: SKRSContext2D;
  const layoutText = layoutTextFallback;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("lays out single line text", () => {
    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black" },
      500,
      ctx,
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe("Hello");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("applies text transform uppercase", () => {
    const result = layoutText(
      "hello",
      { fontSize: 16, color: "black", textTransform: "uppercase" },
      500,
      ctx,
    );
    expect(result.segments[0]!.text).toBe("HELLO");
  });

  it("applies text transform lowercase", () => {
    const result = layoutText(
      "HELLO",
      { fontSize: 16, color: "black", textTransform: "lowercase" },
      500,
      ctx,
    );
    expect(result.segments[0]!.text).toBe("hello");
  });

  it("hangs trailing spaces when deciding whether a word fits", () => {
    // Mock measures 8px per character: "aaa bbb" is exactly 56px wide.
    // The space after "bbb" must not count toward the line fitting.
    const result = layoutText(
      "aaa bbb ccc",
      { fontSize: 16, color: "black" },
      56,
      ctx,
    );
    expect(result.segments.map((s) => s.text)).toEqual(["aaa bbb", "ccc"]);
  });

  it("clamps lines with lineClamp and adds ellipsis", () => {
    const longText =
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";
    const unclamped = layoutText(
      longText,
      { fontSize: 16, color: "black" },
      150,
      ctx,
    );
    expect(unclamped.segments.length).toBeGreaterThan(2);

    const clamped = layoutText(
      longText,
      { fontSize: 16, color: "black", lineClamp: 2 },
      150,
      ctx,
    );
    expect(clamped.segments).toHaveLength(2);
    expect(clamped.segments[1]!.text).toContain("\u2026");
    expect(clamped.height).toBeLessThan(unclamped.height);
  });

  it("keeps baseline within line box when hhea metrics shrink auto lineHeight below font content", () => {
    // hhea metrics: ascender=600, descender=-150 → lineHeight=12px
    // Font-derived: ascent=9.6, descent=2.4 → contentHeight=12 (equal)
    // No scaling needed, baselineY = (12 + 9.6 - 2.4) / 2 = 9.6
    vi.mocked(getFontMetrics).mockReturnValue({
      ascender: 600,
      descender: -150,
      unitsPerEm: 1000,
      // (600 + 150) / 1000 * 16 = 12px lineHeight
    });

    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black" }, // line-height: normal (auto)
      500,
      ctx,
    );
    const seg = result.segments[0]!;
    // seg.y is the baseline Y; it must stay within [0, lineHeightPx=12]
    expect(seg.y).toBeGreaterThanOrEqual(0);
    expect(seg.y).toBeLessThanOrEqual(12);

    // totalHeight is ceiled to prevent Yoga rounding from clipping descent
    expect(result.height).toBe(Math.ceil(result.height));

    // Reset mock
    vi.mocked(getFontMetrics).mockReturnValue(null);
  });

  it("ceils totalHeight when descent overflows the line box", () => {
    // hhea metrics: (775 + 194) / 1000 * 16 = 15.504 lineHeightPx
    // Font-derived ascent = 12.4, descent = 3.104 → contentHeight = 15.504
    // baselineY = (15.504 + 12.4 - 3.104) / 2 = 12.4
    // Ceiled to 16 to prevent Yoga rounding from clipping descent.
    vi.mocked(getFontMetrics).mockReturnValue({
      ascender: 775,
      descender: -194,
      unitsPerEm: 1000,
    });

    const result = layoutText("g", { fontSize: 16, color: "black" }, 500, ctx);

    expect(result.height).toBe(16);

    vi.mocked(getFontMetrics).mockReturnValue(null);
  });

  it("does not scale baseline for explicit tight lineHeight", () => {
    // With explicit lineHeight, overflow is intentional — use standard half-leading.
    // Mock canvas: ascent=12, descent=4, contentHeight=16, lineHeight=10.
    // Original formula: baselineY = (10 + 12 - 4) / 2 = 9
    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black", lineHeight: 10 },
      500,
      ctx,
    );
    const seg = result.segments[0]!;
    expect(seg.y).toBe(9);
  });

  it("does not clamp when text fits within lineClamp", () => {
    const result = layoutText(
      "Short",
      { fontSize: 16, color: "black", lineClamp: 3 },
      500,
      ctx,
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe("Short");
  });
});
