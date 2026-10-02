import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import type { ComputedStyle } from "../src/jsx/style/compute.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { layoutText } from "../src/jsx/text/index.ts";
import {
  HAS_NATIVE_DEPS,
  compareImages,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
} from "./_helpers/setup.ts";

const TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

// Text laid out as one native paragraph (@effing/skia's `Paragraph`), which
// Skia breaks, shapes and paints.
describe.skipIf(!HAS_NATIVE_DEPS)("native paragraph layout", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
    ensureFontsRegistered(fonts);
  });

  const style = (s: Partial<ComputedStyle>) =>
    ({
      fontFamily: "Liberation Sans",
      color: "black",
      ...s,
    }) as ComputedStyle;

  // Widths at which a line ends exactly at, or just short of, a word: a
  // line's trailing space must not count toward whether it fits.
  it.each([
    [69, 16],
    [105, 16],
    [150, 20],
    [177, 24],
  ])("wraps a %spx-wide %spx paragraph like satori", async (w, fontSize) => {
    const element = (
      <div
        style={{
          width: 300,
          height: 400,
          display: "flex",
          background: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div style={{ width: w, fontSize, color: "black", display: "block" }}>
          {TEXT}
        </div>
      </div>
    );
    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, 300, 400, fonts),
      renderWithSatori(element, 300, 400, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      `native-wrap-${w}-${fontSize}`,
    );
    expect(percentage).toBeLessThan(1.2);
  });

  it("places lines on CSS half-leading baselines from the hhea metrics", () => {
    // Liberation Sans: hhea ascender 1854, descender -434, unitsPerEm 2048.
    const ascent = (1854 / 2048) * 20;
    const descent = (434 / 2048) * 20;
    const result = layoutText(
      TEXT,
      style({ fontSize: 20, lineHeight: 30 }),
      200,
    );
    expect(result.paragraph).toBeDefined();
    expect(result.segments.length).toBeGreaterThan(2);
    result.segments.forEach((seg, i) => {
      expect(seg.y).toBeCloseTo(i * 30 + (30 + ascent - descent) / 2, 4);
    });
    expect(result.height).toBeCloseTo(result.segments.length * 30, 4);
  });

  it("sizes `normal` line boxes from the hhea metrics, rounded up", () => {
    const result = layoutText("Hello", style({ fontSize: 20 }), 10_000);
    // (1854 + 434) / 2048 * 20 = 22.34…
    expect(result.segments[0]!.height).toBeCloseTo(22.3438, 3);
    expect(result.height).toBe(23);
  });

  it("measures and centres an ellipsized line with its ellipsis", () => {
    const result = layoutText(
      TEXT,
      style({ fontSize: 20, lineClamp: 2, textAlign: "center" }),
      300,
    );
    expect(result.segments).toHaveLength(2);
    const last = result.segments[1]!;
    const clipped = layoutText(TEXT, style({ fontSize: 20, lineClamp: 2 }), 300)
      .segments[1]!;
    // The painted line is its text plus "…", wider than the text alone.
    expect(last.width).toBeGreaterThan(
      layoutText(last.text, style({ fontSize: 20 }), 10_000).width,
    );
    expect(last.x + last.width / 2).toBeCloseTo(150, 3);
    expect(clipped.x).toBe(0);
  });

  it("puts letter spacing after each glyph, as CSS does", () => {
    const plain = layoutText("Hello", style({ fontSize: 20 }), 10_000);
    const spaced = layoutText(
      "Hello",
      style({ fontSize: 20, letterSpacing: 3 }),
      10_000,
    );
    expect(spaced.segments[0]!.x).toBe(0);
    expect(spaced.width).toBeCloseTo(plain.width + 5 * 3, 3);
  });

  it("leaves a word wider than the box unbroken, to overflow", () => {
    // Skia would break the word mid-way to fit; CSS without `overflow-wrap`
    // doesn't, so this text goes through the TypeScript layout instead.
    const result = layoutText(
      "A supercalifragilisticexpialidocious word",
      style({ fontSize: 20 }),
      80,
    );
    expect(result.paragraph).toBeUndefined();
    expect(result.segments.map((s) => s.text)).toEqual([
      "A",
      "supercalifragilisticexpialidocious",
      "word",
    ]);
  });

  it("start-aligns a centred or right-aligned line that overflows, as browsers do", () => {
    for (const textAlign of ["center", "right"] as const) {
      const overflowing = layoutText(
        "An overflowing title",
        style({ fontSize: 20, whiteSpace: "nowrap", textAlign }),
        100,
      );
      expect(overflowing.paragraph).toBeDefined();
      expect(overflowing.segments[0]!.width).toBeGreaterThan(100);
      expect(overflowing.segments[0]!.x).toBe(0);
      // The TypeScript layout, which a too-wide word goes through, agrees.
      const word = layoutText(
        "Supercalifragilistic",
        style({ fontSize: 20, textAlign }),
        100,
      );
      expect(word.paragraph).toBeUndefined();
      expect(word.segments[0]!.x).toBe(0);
    }
  });

  it("keeps the trailing spaces of white-space: pre in the line", () => {
    const pre = (text: string) =>
      layoutText(text, style({ fontSize: 20, whiteSpace: "pre" }), 10_000);
    const space = pre("a b").width - pre("ab").width;
    expect(pre("Hello   ").width).toBeCloseTo(
      pre("Hello").width + 3 * space,
      1,
    );
  });

  it("collapses the line box for a line height of 0", () => {
    const result = layoutText(
      "Hello world",
      style({ fontSize: 20, lineHeight: 0 }),
      500,
    );
    expect(result.height).toBe(0);
  });

  it("agrees with the TypeScript layout on where lines break", () => {
    for (const width of [69, 105, 150, 177, 240, 400]) {
      const native = layoutText(TEXT, style({ fontSize: 20 }), width);
      // `word-break: break-all` only differs once a word is wider than the
      // box, and takes the TypeScript layout.
      const typescript = layoutText(
        TEXT,
        style({ fontSize: 20, wordBreak: "break-all" }),
        width,
      );
      expect(native.paragraph).toBeDefined();
      expect(typescript.paragraph).toBeUndefined();
      expect(native.segments.map((s) => s.text)).toEqual(
        typescript.segments.map((s) => s.text),
      );
    }
  });
});
