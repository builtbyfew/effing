import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
} from "./_helpers/setup.ts";

// Horizontal span of ink (non-near-black pixels) in a rendered frame.
function inkWidth(png: Buffer): number {
  const img = PNG.sync.read(png);
  let minX = img.width;
  let maxX = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i]! + img.data[i + 1]! + img.data[i + 2]! > 90) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  return maxX - minX;
}

// A CSS transform must not clip the element's own content. The pure-scale
// offscreen path used to rasterize the subtree into a buffer sized to the
// layout box and hard-clip to it, slicing ink that overflows the box — e.g. a
// trailing glyph pushed past the box edge by negative letter-spacing.
describe.skipIf(!HAS_NATIVE_DEPS)(
  "transform must not clip overflowing ink",
  () => {
    let fonts: FontData[];

    beforeAll(async () => {
      fonts = await loadFonts();
    });

    it("keeps ink that overflows the box under a scale transform", async () => {
      const W = 500;
      const H = 200;
      const scale = 2;

      // Negative letter-spacing shrinks the box below the glyph ink, so the
      // trailing "." overhangs the right edge. With transformOrigin at the left
      // edge, a clip in the offscreen buffer shows up as the scaled ink being
      // narrower than `scale ×` the untransformed ink.
      const make = (transform: string) => (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            background: "#000",
            color: "#fff",
            fontFamily: "Liberation Sans",
            fontSize: 110,
          }}
        >
          <span
            style={{
              transform,
              transformOrigin: "left center",
              letterSpacing: -28,
            }}
          >
            {"AVA."}
          </span>
        </div>
      );

      const [none, scaled] = await Promise.all([
        renderWithCanvas(make("none"), W, H, fonts),
        renderWithCanvas(make(`scale(${scale})`), W, H, fonts),
      ]);

      const ratio = inkWidth(scaled) / inkWidth(none);

      // The scaled ink should be `scale ×` as wide as the untransformed ink.
      // The pre-fix offscreen clip capped it at ~1.5× (right side sliced off).
      expect(ratio).toBeGreaterThan(scale * 0.95);
      expect(ratio).toBeLessThan(scale * 1.05);
    });
  },
);

// Summed red-box coverage along a row and a column: a subpixel measure of the
// box's rendered width and height (the box is pure red on white).
function redExtent(png: Buffer, row: number, col: number) {
  const img = PNG.sync.read(png);
  const coverage = (x: number, y: number) =>
    1 - img.data[(y * img.width + x) * 4 + 1]! / 255;
  let width = 0;
  let height = 0;
  for (let x = 0; x < img.width; x++) width += coverage(x, row);
  for (let y = 0; y < img.height; y++) height += coverage(col, y);
  return { width, height };
}

// The pure-scale offscreen path pads its buffer by a bleed derived from the
// subtree's font size. A fractional bleed made the buffer's ceil'd pixel size
// overshoot the logical area it was composited into, shrinking the scaled
// content by up to a pixel relative to the direct (unscaled) path.
describe.skipIf(!HAS_NATIVE_DEPS)(
  "scale offscreen path lands on the same pixels",
  () => {
    let fonts: FontData[];

    beforeAll(async () => {
      fonts = await loadFonts();
    });

    it.each([0.9999, 1.5, 2])(
      "scale(%s) with a fractional font size",
      async (scale) => {
        const W = 300;
        const H = 200;
        const make = (transform: string) => (
          <div
            style={{
              width: W,
              height: H,
              display: "flex",
              background: "#fff",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 20,
                top: 20,
                width: 100,
                height: 50,
                display: "flex",
                background: "red",
                transform,
                transformOrigin: "left top",
              }}
            >
              <span
                style={{
                  fontFamily: "Liberation Sans",
                  fontSize: 13.01,
                  color: "red",
                }}
              >
                {"Hi"}
              </span>
            </div>
          </div>
        );

        const png = await renderWithCanvas(
          make(`scale(${scale})`),
          W,
          H,
          fonts,
        );
        const { width, height } = redExtent(png, 60, 60);

        expect(width).toBeCloseTo(100 * scale, 1);
        expect(height).toBeCloseTo(50 * scale, 1);
      },
    );
  },
);
