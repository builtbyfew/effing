import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import type { ComputedStyle } from "../src/jsx/style/compute.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { layoutText } from "../src/jsx/text/index.ts";
import { nativeTextEnabled } from "../src/jsx/text/native.ts";
import {
  HAS_NATIVE_DEPS,
  compareImages,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
} from "./_helpers/setup.ts";

const TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

// Paragraph layout through the @effing/skia `Paragraph` primitive
// (EFFING_NATIVE_TEXT=1). Skipped on stock @napi-rs/canvas.
describe.skipIf(!HAS_NATIVE_DEPS || !nativeTextEnabled())(
  "native paragraph layout",
  () => {
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

    // Like satori and CSS, a line's trailing space doesn't count toward
    // whether it fits. The TS layout counts it, so at these widths it breaks
    // a word earlier than satori does.
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
      expect(result.segments.length).toBeGreaterThan(2);
      result.segments.forEach((seg, i) => {
        expect(seg.y).toBeCloseTo(i * 30 + (30 + ascent - descent) / 2, 4);
      });
      expect(result.height).toBeCloseTo(result.segments.length * 30, 4);
    });

    it("measures and centres an ellipsized line with its ellipsis", () => {
      const result = layoutText(
        TEXT,
        style({ fontSize: 20, lineClamp: 2, textAlign: "center" }),
        300,
      );
      expect(result.segments).toHaveLength(2);
      const last = result.segments[1]!;
      const clipped = layoutText(
        TEXT,
        style({ fontSize: 20, lineClamp: 2 }),
        300,
      ).segments[1]!;
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
  },
);
