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

// Brightness-weighted centroid of a frame (white ink on black): a subpixel
// measure of where the ink sits.
function inkCentroid(png: Buffer): { x: number; y: number } {
  const img = PNG.sync.read(png);
  let mass = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const v = img.data[(y * img.width + x) * 4]!;
      mass += v;
      sumX += v * x;
      sumY += v * y;
    }
  }
  return { x: sumX / mass, y: sumY / mass };
}

// The pure-scale offscreen path supersamples by ceil(|scale|). Hinted glyphs
// snapped to the device grid land a fraction of a pixel away at q× from where
// they land at 1× or (q+1)×, so an animated scale crossing 1, 2, 3, … made
// text jump while boxes stayed put. With @effing/skia, text is unhinted and
// filled as outlines at its exact position (textRendering: geometricPrecision),
// so scaled subtrees can be drawn straight through the transform instead
// (EFFING_DIRECT_SCALE=1), with nothing to switch at whole scales.
describe.skipIf(!HAS_NATIVE_DEPS || process.env.EFFING_DIRECT_SCALE !== "1")(
  "scaled text moves continuously across whole scales",
  () => {
    const W = 900;
    const H = 420;
    const LEFT = 20.3;
    const TOP = 200.37;
    let fonts: FontData[];

    beforeAll(async () => {
      fonts = await loadFonts();
    });

    const centroid = async (fontSize: number, scale?: number) => {
      const png = await renderWithCanvas(
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            background: "#000",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: LEFT,
              top: TOP,
              display: "flex",
              fontFamily: "Liberation Sans",
              fontWeight: 700,
              fontSize,
              color: "#fff",
              transformOrigin: "left center",
              transform: scale === undefined ? undefined : `scale(${scale})`,
            }}
          >
            {"Hello"}
          </div>
        </div>,
        W,
        H,
        fonts,
      );
      return inkCentroid(png);
    };

    it.each([40, 60, 97.3])(
      "%spx text doesn't jump when leaving scale(1)",
      async (fontSize) => {
        const none = await centroid(fontSize);
        for (const scale of [0.9999, 1.0001]) {
          const c = await centroid(fontSize, scale);
          expect(Math.abs(c.x - none.x)).toBeLessThan(0.05);
          expect(Math.abs(c.y - none.y)).toBeLessThan(0.05);
        }
      },
    );

    it.each([40, 60, 97.3])(
      "%spx text doesn't jump when crossing scale(2) and scale(3)",
      async (fontSize) => {
        for (const k of [2, 3]) {
          const below = await centroid(fontSize, k - 0.0001);
          const above = await centroid(fontSize, k + 0.0001);
          // Geometric motion from scaling about the left edge over Δs = 0.0002.
          const expectedDx = ((below.x - LEFT) * 0.0002) / k;
          expect(Math.abs(above.x - below.x - expectedDx)).toBeLessThan(0.05);
          expect(Math.abs(above.y - below.y)).toBeLessThan(0.05);
        }
      },
    );

    it.each([40, 60, 97.3])(
      "%spx text moves monotonically as scale eases up from 1",
      async (fontSize) => {
        const points = [await centroid(fontSize)];
        for (let i = 1; i <= 100; i++) {
          points.push(await centroid(fontSize, 1 + i * 0.0001));
        }
        for (const axis of ["x", "y"] as const) {
          const direction =
            Math.sign(points[100]![axis] - points[0]![axis]) || 1;
          for (let i = 1; i < points.length; i++) {
            // Each frame is a fresh rasterization, so anti-aliasing adds up to
            // ≈0.09px of noise on top of the ≈0.01px of geometric motion per
            // 0.0001 of scale; stock Skia steps by up to a whole pixel here.
            const step = points[i]![axis] - points[i - 1]![axis];
            expect(step * direction).toBeGreaterThan(-0.1);
            expect(Math.abs(step)).toBeLessThan(0.1);
          }
        }
      },
    );
  },
);
