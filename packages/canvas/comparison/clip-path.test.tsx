import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
} from "./_helpers/setup.ts";

const WIDTH = 400;
const HEIGHT = 300;

function pixel(png: Buffer, x: number, y: number): [number, number, number] {
  const img = PNG.sync.read(png);
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
}

const isWhite = ([r, g, b]: [number, number, number]) =>
  r > 245 && g > 245 && b > 245;
const isBlue = ([r, g, b]: [number, number, number]) =>
  r < 80 && g < 150 && b > 200;

/** A 200×200 blue box centred in a white 400×300 frame. */
function frame(style: React.CSSProperties, children?: React.ReactNode) {
  return (
    <div
      style={{
        display: "flex",
        width: WIDTH,
        height: HEIGHT,
        background: "white",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 200,
          height: 200,
          background: "#3B82F6",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: clip-path", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    fonts = await loadFonts();
  });

  const cases: [string, string][] = [
    ["circle", "circle(40% at 50% 50%)"],
    ["circle-offset", "circle(30% at 30% 70%)"],
    ["ellipse", "ellipse(50% 30% at center)"],
    ["inset-round", "inset(10% 20% round 20px)"],
    ["polygon", "polygon(50% 0%, 100% 100%, 0% 100%)"],
    ["path", "path('M0 0 H200 V100 L100 200 L0 100 Z')"],
  ];

  for (const [name, clipPath] of cases) {
    it(`matches satori for clip-path: ${clipPath}`, async () => {
      const element = frame({ clipPath });
      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `clip-path-${name}`,
      );
      expect(percentage).toBeLessThan(1);
    });
  }
});

describe.skipIf(!HAS_NATIVE_DEPS)("clip-path rendering", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it("clips with shape()", async () => {
    // A downward-pointing triangle.
    const png = await renderWithCanvas(
      frame({
        clipPath: "shape(from 0 0, line to 100% 0, line to 50% 100%, close)",
      }),
      WIDTH,
      HEIGHT,
      fonts,
    );
    // Box spans x 100..300, y 50..250.
    expect(isBlue(pixel(png, 200, 60))).toBe(true); // top centre: inside
    expect(isBlue(pixel(png, 200, 240))).toBe(true); // bottom tip: inside
    expect(isWhite(pixel(png, 110, 240))).toBe(true); // bottom-left: clipped
    expect(isWhite(pixel(png, 290, 240))).toBe(true); // bottom-right: clipped
  });

  it("clips with shape() arcs and curves", async () => {
    // Left half of the box is a semicircle bulging left; right edge straight.
    const png = await renderWithCanvas(
      frame({
        clipPath:
          "shape(from 50% 0, hline to 100%, vline to 100%, hline to 50%, arc to 50% 0 of 50% 50% cw, close)",
      }),
      WIDTH,
      HEIGHT,
      fonts,
    );
    expect(isBlue(pixel(png, 250, 150))).toBe(true); // right half: inside
    expect(isBlue(pixel(png, 120, 150))).toBe(true); // left bulge centre: inside
    expect(isWhite(pixel(png, 110, 60))).toBe(true); // top-left corner: clipped
    expect(isWhite(pixel(png, 110, 240))).toBe(true); // bottom-left corner: clipped
  });

  it("clips children and box-shadow", async () => {
    const png = await renderWithCanvas(
      frame(
        {
          clipPath: "circle(80px at center)",
          boxShadow: "0 0 30px red",
        },
        // A child bleeding past the circle at the corners.
        <div
          style={{
            display: "flex",
            width: 200,
            height: 200,
            background: "#22C55E",
          }}
        />,
      ),
      WIDTH,
      HEIGHT,
      fonts,
    );
    // Child corner outside the circle is clipped away.
    expect(isWhite(pixel(png, 105, 55))).toBe(true);
    // Shadow outside the clip is gone too (would otherwise be reddish).
    expect(isWhite(pixel(png, 200, 60))).toBe(true);
    // Inside the circle the child shows.
    const [r, g] = pixel(png, 200, 150);
    expect(g).toBeGreaterThan(150);
    expect(r).toBeLessThan(100);
  });

  it("clips to a geometry box", async () => {
    const png = await renderWithCanvas(
      frame({ clipPath: "content-box", padding: 40 }),
      WIDTH,
      HEIGHT,
      fonts,
    );
    expect(isWhite(pixel(png, 110, 150))).toBe(true); // padding area clipped
    expect(isBlue(pixel(png, 200, 150))).toBe(true); // content area shows
  });

  it("follows the element's transform", async () => {
    // Clip to the top half, then rotate 180°: the painted half ends up at the
    // bottom.
    const png = await renderWithCanvas(
      frame({ clipPath: "inset(0 0 50% 0)", transform: "rotate(180deg)" }),
      WIDTH,
      HEIGHT,
      fonts,
    );
    expect(isWhite(pixel(png, 200, 70))).toBe(true);
    expect(isBlue(pixel(png, 200, 230))).toBe(true);
  });

  it("resolves em units in clip-path", async () => {
    // 5em at fontSize 20 = 100px inset from the left: left half clipped.
    const png = await renderWithCanvas(
      frame({ clipPath: "inset(0 0 0 5em)", fontSize: 20 }),
      WIDTH,
      HEIGHT,
      fonts,
    );
    expect(isWhite(pixel(png, 150, 150))).toBe(true);
    expect(isBlue(pixel(png, 250, 150))).toBe(true);
  });
});
