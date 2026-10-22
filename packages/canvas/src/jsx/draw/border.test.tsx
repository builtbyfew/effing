import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import { createCanvas, renderReactElement } from "../../index.ts";

// A 200×100 box at (20, 20) on a white frame.
const X = 20;
const Y = 20;
const W = 200;
const H = 100;

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
  /** The x, relative to the box, just past the last pixel `test` matches. */
  const rightmost = (row: number, test: (x: number, y: number) => boolean) => {
    let last = -1;
    for (let x = 0; x < canvas.width; x++) if (test(x, Y + row)) last = x;
    return last < 0 ? 0 : last + 1 - X;
  };
  return { at, isGreen, isRed, outside, rightmost };
}

describe("rounded borders of unequal widths", () => {
  // CSS Backgrounds 3: the padding box's corner radii are the border box's,
  // less the adjoining borders' widths on each axis.
  const B = 12;
  const R = 24;

  it("draws a left border inside the box, tapering at the corners", async () => {
    const { isGreen, outside, rightmost } = await render({
      backgroundColor: "#888",
      borderLeft: `${B}px solid #0f0`,
      borderRadius: R,
    });

    expect(outside(isGreen)).toBe(0);

    // The inner edge, an ellipse with radii 12 and 24, at each row's centre.
    for (const row of [2, 6, 12, 18, 30, 50]) {
      const dy = Math.max(0, R - (row + 0.5));
      const inner = B + (R - B) * (1 - Math.sqrt(1 - (dy / R) ** 2));
      expect(Math.abs(rightmost(row, isGreen) - inner)).toBeLessThanOrEqual(1);
    }
    // Mirrored at the bottom.
    for (const row of [2, 12, 30]) {
      expect(rightmost(H - 1 - row, isGreen)).toBe(rightmost(row, isGreen));
    }
  });

  it("splits a corner between sides of different colours", async () => {
    // A 12px left border in green and a 4px top border in red.
    const { isGreen, isRed, outside, at } = await render({
      backgroundColor: "#888",
      borderLeft: `${B}px solid #0f0`,
      borderTop: "4px solid #f00",
      borderRadius: R,
    });

    expect(outside(isGreen)).toBe(0);
    expect(outside(isRed)).toBe(0);
    // Along the edges, away from the corner.
    expect(isGreen(X + 6, Y + 50)).toBe(true);
    expect(isRed(X + 100, Y + 2)).toBe(true);
    expect(at(X + 100, Y + 6)).toEqual([0x88, 0x88, 0x88]);
    expect(at(X + 16, Y + 50)).toEqual([0x88, 0x88, 0x88]);
    // At the corner, split along the line from (0, 0) to (12, 4): red above,
    // green below.
    expect(isRed(X + 22, Y + 2)).toBe(true);
    expect(isGreen(X + 4, Y + 14)).toBe(true);
    // The top border runs to the top right corner and tapers there, without
    // turning down the right side, which has none.
    expect(isRed(X + W - 30, Y + 2)).toBe(true);
    expect(isRed(X + W - 2, Y + 30)).toBe(false);
  });

  it.each([
    ["top", { borderTop: "10px solid #0f0" }],
    ["right", { borderRight: "10px solid #0f0" }],
    ["bottom", { borderBottom: "10px solid #0f0" }],
    ["left", { borderLeft: "10px solid #0f0" }],
  ])("keeps a %s border inside the box", async (_, style) => {
    const { isGreen, outside } = await render({
      backgroundColor: "#888",
      borderRadius: R,
      ...style,
    });
    expect(outside(isGreen)).toBe(0);
  });

  it.each([
    ["top", { borderTopColor: "#f00" }, X + 100, Y + 4],
    ["right", { borderRightColor: "#f00" }, X + W - 5, Y + 50],
    ["bottom", { borderBottomColor: "#f00" }, X + 100, Y + H - 5],
    ["left", { borderLeftColor: "#f00" }, X + 4, Y + 50],
  ])(
    "draws each side of a border in its own colour (%s in red)",
    async (_, colors, rx, ry) => {
      const { isGreen, isRed, outside } = await render({
        backgroundColor: "#888",
        border: "10px solid #0f0",
        borderRadius: R,
        ...colors,
      });
      expect(outside(isGreen)).toBe(0);
      expect(outside(isRed)).toBe(0);
      expect(isRed(rx, ry)).toBe(true);
      // The opposite side stays green.
      expect(isGreen(X * 2 + W - rx - 1, Y * 2 + H - ry - 1)).toBe(true);
    },
  );
  it("splits sides of different colours without the background between them", async () => {
    const { at } = await render({
      backgroundColor: "#888",
      borderTop: "10px solid #f00",
      borderRight: "10px solid #f00",
      borderBottom: "10px solid #00f",
      borderLeft: "10px solid #0f0",
      borderRadius: R,
    });
    // Along each split, a blend of the two sides' colours: the grey
    // background has green in it, red and blue none, so no green where
    // red meets blue, and none of the blue channel where red meets green.
    // Inside the corners' curves, from 8px to 13px along the diagonals.
    for (let d = 8; d < 14; d++) {
      expect(at(X + W - 1 - d, Y + H - 1 - d)[1]).toBeLessThan(8);
      expect(at(X + d, Y + d)[2]).toBeLessThan(8);
      expect(at(X + d, Y + H - 1 - d)[0]).toBeLessThan(8);
    }
  });

  it.each([
    ["transparent", [0x88, 0x88, 0x88]],
    ["rgba(0, 0, 255, 0.5)", [0x44, 0x44, 0xc4]],
  ])(
    "shows what is under a %s side, not the side next to it",
    async (color, expected) => {
      const { at, isRed } = await render({
        backgroundColor: "#888",
        borderTop: "10px solid #f00",
        // Longhands: the shorthand splits on the spaces in rgba().
        borderLeftWidth: 10,
        borderLeftStyle: "solid",
        borderLeftColor: color,
        borderRadius: R,
      });
      for (const y of [Y + 30, Y + 50, Y + 80]) {
        for (const x of [X + 2, X + 5, X + 8]) {
          const px = at(x, y);
          for (let c = 0; c < 3; c++) {
            expect(Math.abs(px[c]! - expected[c]!)).toBeLessThanOrEqual(1);
          }
        }
      }
      // Nor a line of the top side's colour along the split from (0, 0) to
      // (10, 10), in the pixels just under it.
      for (let d = 8; d < 14; d++) {
        expect(at(X + d - 1, Y + d)[0]).toBeLessThan(160);
      }
      expect(isRed(X + 100, Y + 5)).toBe(true);
    },
  );

  it("blends a side's curved edge with the background, not another side", async () => {
    const { at } = await render({
      borderTop: "10px solid #f00",
      borderLeft: "10px solid #0f0",
      borderRadius: R,
    });
    // Green over white, no red, on the left side's curved edges: all of the
    // bottom left corner, and the top left below the split from (0, 0) to
    // (10, 10), with a margin for its antialiasing.
    let blended = 0;
    const check = (x: number, y: number) => {
      const [r, g, b] = at(x, y);
      expect(r).toBe(b);
      if (g! > r! && r! > 0) blended++;
    };
    for (let dy = 0; dy < R; dy++) {
      for (let dx = 0; dx < R; dx++) {
        check(X + dx, Y + H - 1 - dy);
        if (dy - dx >= 3) check(X + dx, Y + dy);
      }
    }
    // The curves were sampled where they are antialiased, not only where
    // they are solid green or white.
    expect(blended).toBeGreaterThan(10);
  });

  it.each([
    ["black", {}, [0, 0, 0]],
    ["the element's colour", { color: "#0f0" }, [0, 255, 0]],
  ])("draws currentColor in %s", async (_, colorStyle, expected) => {
    const { at } = await render({
      backgroundColor: "#888",
      border: "10px solid currentColor",
      borderLeftColor: "#f00",
      borderRadius: R,
      ...colorStyle,
    });
    expect(at(X + 100, Y + 5)).toEqual(expected);
    expect(at(X + W - 5, Y + 50)).toEqual(expected);
    expect(at(X + 5, Y + 50)).toEqual([255, 0, 0]);
  });

  it("clamps the radius as the background does", async () => {
    // A pill: the radius is clamped to half the height, 50px.
    const { isGreen, outside, rightmost, at } = await render({
      backgroundColor: "#888",
      borderLeft: `${B}px solid #0f0`,
      borderRadius: 500,
    });
    expect(outside(isGreen)).toBe(0);
    // At the middle row, the full width; the inner edge (radii 38 and 50)
    // meets the outer curve at the top.
    expect(rightmost(50, isGreen)).toBe(B);
    const dy = 50 - 10.5;
    const inner = B + 38 * (1 - Math.sqrt(1 - (dy / 50) ** 2));
    expect(Math.abs(rightmost(10, isGreen) - inner)).toBeLessThanOrEqual(1);
    // The background's corner is cut by the same curve.
    expect(at(X + 2, Y + 2)).toEqual([255, 255, 255]);
  });

  it("fills the whole box when the borders meet in the middle", async () => {
    const { isGreen, isRed, outside, at } = await render({
      backgroundColor: "#888",
      borderTop: "50px solid #f00",
      borderBottom: "50px solid #0f0",
      borderRadius: R,
    });
    expect(outside(isGreen)).toBe(0);
    expect(outside(isRed)).toBe(0);
    expect(isRed(X + 100, Y + 30)).toBe(true);
    expect(isGreen(X + 100, Y + 70)).toBe(true);
    // No background shows through.
    for (const y of [Y + 40, Y + 49, Y + 50, Y + 60, Y + 2, Y + H - 3]) {
      expect(at(X + 100, y)).not.toEqual([0x88, 0x88, 0x88]);
    }
  });

  it.each([["currentColor"], ["inherit"], ["nope"]])(
    "draws currentColor in black for an element whose colour is %s",
    async (color) => {
      const { at } = await render({
        backgroundColor: "#888",
        border: "10px solid currentColor",
        color,
      });
      expect(at(X + 100, Y + 5)).toEqual([0, 0, 0]);
    },
  );

  it("scales the padding box's corners down to fit it", async () => {
    // The padding box is 15px wide, but its right corners' radii are 25px.
    const { at } = await render({
      backgroundColor: "#888",
      borderLeft: "180px solid #0f0",
      borderRight: "5px solid #f00",
      borderTopRightRadius: 30,
      borderBottomRightRadius: 30,
    });
    // No background shows in the left border, along the top and bottom,
    for (let x = X; x < X + 170; x++) {
      expect(at(x, Y)).toEqual([0, 255, 0]);
      expect(at(x, Y + H - 1)).toEqual([0, 255, 0]);
    }
    // and the padding box's corners, which now reach past the border box's
    // curve, paint nothing there.
    for (let x = X + 177; x < X + W; x++) {
      expect(at(x, Y)).toEqual([255, 255, 255]);
      expect(at(x, Y + H - 1)).toEqual([255, 255, 255]);
    }
  });

  it("draws a negative width, which CSS doesn't allow, as none", async () => {
    const { isGreen, outside } = await render({
      backgroundColor: "#888",
      borderTop: "10px solid #0f0",
      borderLeftWidth: -10,
      borderRadius: R,
    });
    expect(outside(isGreen)).toBe(0);
  });
});

describe("square borders", () => {
  it("fills each side, the corners split diagonally", async () => {
    const { isGreen, isRed, at } = await render({
      backgroundColor: "#888",
      borderTop: "10px solid #f00",
      borderLeft: "10px solid #0f0",
    });
    expect(isRed(X + 100, Y)).toBe(true);
    expect(isRed(X + 100, Y + 9)).toBe(true);
    expect(isGreen(X, Y + 50)).toBe(true);
    expect(isGreen(X + 9, Y + 50)).toBe(true);
    expect(at(X + 100, Y + 10)).toEqual([0x88, 0x88, 0x88]);
    // Either side of the corner's diagonal.
    expect(isRed(X + 7, Y + 2)).toBe(true);
    expect(isGreen(X + 2, Y + 7)).toBe(true);
  });

  it("fills a border of one width and colour up to the box's edges", async () => {
    const { at } = await render({
      backgroundColor: "#888",
      border: "3px solid #0f0",
    });
    for (const [x, y] of [
      [X, Y],
      [X + W - 1, Y + H - 1],
      [X + 2, Y + 50],
    ] as const) {
      expect(at(x, y)).toEqual([0, 255, 0]);
    }
    expect(at(X + 3, Y + 50)).toEqual([0x88, 0x88, 0x88]);
    expect(at(X - 1, Y + 50)).toEqual([255, 255, 255]);
  });
});
