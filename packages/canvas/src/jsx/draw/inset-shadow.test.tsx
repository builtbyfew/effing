import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import { createCanvas, renderReactElement } from "../../index.ts";

// A 200×100 box at (20, 20) on a white frame.
const X = 20;
const Y = 20;
const W = 200;
const H = 100;

/** The box, filled green by an inset shadow, inside a red border. */
async function render(style: CSSProperties) {
  const canvas = createCanvas(X * 2 + W, Y * 2 + H);
  const ctx = canvas.getContext("2d");
  await renderReactElement(
    ctx,
    <div
      style={{
        display: "flex",
        width: X * 2 + W,
        height: Y * 2 + H,
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: X,
          top: Y,
          width: W,
          height: H,
          backgroundColor: "#fff",
          boxShadow: "inset 0 0 0 200px #0f0",
          ...style,
        }}
      />
    </div>,
    {},
  );
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const at = (x: number, y: number) => {
    const i = (y * canvas.width + x) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };
  const isGreen = (x: number, y: number) => {
    const [r, g, b] = at(x, y);
    return g! > 200 && r! < 100 && b! < 100;
  };
  const isRed = (x: number, y: number) => {
    const [r, g, b] = at(x, y);
    return r! > 200 && g! < 100 && b! < 100;
  };
  const isWhite = (x: number, y: number) => at(x, y).every((c) => c === 255);
  /** The pixels in the frame, outside the box, that `test` matches. */
  const outside = (test: (x: number, y: number) => boolean) => {
    let n = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const inBox = x >= X && x < X + W && y >= Y && y < Y + H;
        if (!inBox && test(x, y)) n++;
      }
    }
    return n;
  };
  /** The x, relative to the box, of the first pixel in a row with green. */
  const leftmostGreen = (row: number) => {
    for (let x = X; x < X + W; x++) {
      const [r, g] = at(x, Y + row);
      if (g! > 127 && r! < 128) return x - X;
    }
    return W;
  };
  return { at, isGreen, isRed, isWhite, outside, leftmostGreen };
}

describe("inset box shadows inside borders of unequal widths", () => {
  // CSS Backgrounds 3: an inset shadow is clipped to the padding box, whose
  // corner radii are the border box's less the adjoining borders' widths on
  // each axis.
  const B = 12;
  const R = 24;

  it("fills the padding box to the border's elliptical inner edge", async () => {
    const { at, isWhite, outside, leftmostGreen } = await render({
      borderLeft: `${B}px solid #f00`,
      borderRadius: R,
    });

    expect(outside((x, y) => !isWhite(x, y))).toBe(0);

    // The inner edge, an ellipse with radii 12 and 24: green starts where the
    // border ends, in each row, with no gap and no overlap.
    for (const row of [1, 2, 4, 6, 9, 12, 18, 23, 30, 50]) {
      const dy = Math.max(0, R - (row + 0.5));
      const inner = B + (R - B) * (1 - Math.sqrt(1 - (dy / R) ** 2));
      for (const r of [row, H - 1 - row]) {
        expect(Math.abs(leftmostGreen(r) - inner)).toBeLessThanOrEqual(1);
      }
    }
    // The right side has no border: its corners are the border box's.
    for (const row of [0, 4, 12, 50]) {
      const dy = Math.max(0, R - (row + 0.5));
      const edge = W - R + Math.sqrt(R ** 2 - dy ** 2);
      let last = -1;
      for (let x = X; x < X + W; x++) {
        if (at(x, Y + row)[0]! < 128) last = x - X;
      }
      expect(Math.abs(last + 1 - edge)).toBeLessThanOrEqual(1);
    }
  });

  it("doesn't fill the border where the border's inner curve is", async () => {
    // A 12px left border and a 4px top border meet at the corner.
    const { isGreen, isRed } = await render({
      borderLeft: `${B}px solid #f00`,
      borderTop: "4px solid #f00",
      borderRadius: R,
    });
    // The padding box's corner has radii 12 and 20, from (12, 4): its curve
    // passes (14, 10.6) and (20, 4.6). A circle of radius 12 would leave a
    // gap at the corner, of white, that the shadow should fill.
    const dy = 20 - (10 + 0.5 - 4);
    const inner = B + 12 * (1 - Math.sqrt(1 - (dy / 20) ** 2));
    expect(isGreen(X + Math.ceil(inner) + 1, Y + 10)).toBe(true);
    expect(isRed(X + Math.floor(inner) - 1, Y + 10)).toBe(true);
  });

  it("keeps the shadow in the border box when its corners are scaled down", async () => {
    // The padding box is 15px wide, but its right corners' radii are 25px.
    const { isGreen, outside, at } = await render({
      borderLeft: "180px solid #f00",
      borderRight: "5px solid #f00",
      borderTopRightRadius: 30,
      borderBottomRightRadius: 30,
    });
    expect(outside(isGreen)).toBe(0);
    // Outside the border box's curve, at its corners, nothing paints.
    for (let x = X + 190; x < X + W; x++) {
      expect(at(x, Y)).toEqual([255, 255, 255]);
      expect(at(x, Y + H - 1)).toEqual([255, 255, 255]);
    }
    expect(isGreen(X + 187, Y + 50)).toBe(true);
  });

  it("treats a negative width, which CSS doesn't allow, as none", async () => {
    const { isGreen, outside, at } = await render({
      borderTop: "10px solid #f00",
      borderLeftWidth: -10,
      borderRadius: R,
    });
    expect(outside(isGreen)).toBe(0);
    // The shadow reaches the left edge of the box, where no border is.
    expect(isGreen(X, Y + 50)).toBe(true);
    expect(at(X + 100, Y + 5)).toEqual([255, 0, 0]);
  });

  it("follows the elliptical corners with the spread's hole", async () => {
    // A 4px spread, inside a 12px left border: the hole's top left corner has
    // radii 8 and 20 (12 and 24 less the spread), from (16, 4).
    const { at } = await render({
      borderLeft: `${B}px solid #f00`,
      borderRadius: R,
      boxShadow: "inset 0 0 0 4px #0f0",
    });
    const green = (x: number, y: number) => {
      const [r, g] = at(X + x, Y + y);
      return g! > 127 && r! < 128;
    };
    // Along the middle, 4px of green beside the border, then white.
    expect(green(B + 1, 50)).toBe(true);
    expect(green(B + 3, 50)).toBe(true);
    expect(green(B + 5, 50)).toBe(false);
    // Along the curve too: in each row, a band about 4px wide.
    for (const row of [10, 14, 18]) {
      let first = -1;
      let last = -1;
      for (let x = 0; x < 60; x++) {
        if (green(x, row)) {
          if (first < 0) first = x;
          last = x;
        }
      }
      expect(first).toBeGreaterThan(0);
      expect(last - first + 1).toBeGreaterThanOrEqual(3);
      expect(last - first + 1).toBeLessThanOrEqual(7);
    }
  });
});
