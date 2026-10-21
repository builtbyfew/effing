import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import { loadFonts, renderWithCanvas } from "./_helpers/setup.ts";

// The sub-pixel top and bottom of what a channel covers in a frame: the
// first and last rows it covers, less the share of them it leaves.
function rowEdges(img: PNG, channel: (i: number) => number) {
  const rows: number[] = [];
  for (let y = 0; y < img.height; y++) {
    let coverage = 0;
    for (let x = 0; x < img.width; x++) {
      coverage = Math.max(coverage, channel((y * img.width + x) * 4));
    }
    rows.push(coverage);
  }
  const covered = rows.flatMap((c, y) => (c > 0.02 ? [y] : []));
  const top = covered[0]!;
  const bottom = covered[covered.length - 1]!;
  return { top: top + 1 - rows[top]!, bottom: bottom + rows[bottom]! };
}

// Text is placed where Yoga lays it out, to the fraction of a pixel (#224).
// Placed on the whole pixel above it, as Yoga rounds text, it lost the
// fraction of padding, border or centring above it, always upwards, while
// the box around it, rounded to the nearest pixel, kept it below: a badge
// with 0.75px of padding had 4.25px above its caps and 6px below.
describe("text a fraction of a pixel into its box is centred in it", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  // How far the caps sit below the centre of a red badge, on black, with
  // green text: the rows the badge covers (red or green) and the rows the
  // text covers (green).
  const offset = async (badge: React.CSSProperties) => {
    const W = 80;
    const H = 60;
    const png = await renderWithCanvas(
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "#000",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            display: "flex",
            alignItems: "center",
            backgroundColor: "#f00",
            color: "#0f0",
            fontFamily: "Liberation Sans",
            fontWeight: 700,
            fontSize: 13.464,
            ...badge,
          }}
        >
          {"MPH"}
        </div>
      </div>,
      W,
      H,
      fonts,
    );
    const img = PNG.sync.read(png);
    const box = rowEdges(img, (i) =>
      Math.min(1, (img.data[i]! + img.data[i + 1]!) / 255),
    );
    const ink = rowEdges(img, (i) => img.data[i + 1]! / 255);
    const above = ink.top - box.top;
    const below = box.bottom - ink.bottom;
    return (above - below) / 2;
  };

  // Each puts the text `fraction` of a pixel further into the badge than a
  // whole number of pixels. (The line box is 15px tall: centred in 17px, the
  // text is 1px down.)
  const sweeps: {
    name: string;
    badge: (fraction: number) => React.CSSProperties;
  }[] = [
    {
      name: "padding",
      badge: (fraction) => ({ padding: `${fraction}px 4px` }),
    },
    {
      name: "border",
      badge: (fraction) => ({
        padding: "2px 4px",
        border: `${fraction}px solid #f00`,
      }),
    },
    {
      name: "centring",
      badge: (fraction) => ({ height: 17 + 2 * fraction, padding: "0 4px" }),
    },
  ];

  it.each(sweeps)(
    "at every twentieth of a pixel of $name",
    async ({ name, badge }) => {
      // From the offset at a whole pixel, which is the font's own: its caps
      // aren't quite centred in its line box.
      const whole = await offset(badge(0));
      const deviations: Record<string, number> = {};
      for (let i = 1; i < 20; i++) {
        deviations[i / 20] = (await offset(badge(i / 20))) - whole;
      }
      const values = Object.values(deviations);
      const bias = values.reduce((a, b) => a + b) / values.length;
      const worst = Math.max(...values.map(Math.abs));
      console.log(
        `[comparison] ${name}: bias ${bias.toFixed(3)}px, worst ${worst.toFixed(3)}px`,
      );
      // The badge is rounded to whole pixels, so its centre is up to 0.25px
      // from where its layout puts it, either way, and Skia covers a row in
      // quarters of a pixel, so offsets come in eighths. Measured on macOS
      // arm64 and Linux x64 alike: a bias of -0.026px, and 0.25px at worst.
      // Placed on the pixel above, the text was 0.526px high on average,
      // and 1px at worst.
      expect(Math.abs(bias), JSON.stringify(deviations)).toBeLessThan(0.15);
      expect(worst, JSON.stringify(deviations)).toBeLessThan(0.4);
    },
  );
});

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

// Text that its layout moves, with no transform, moves as far as its layout
// does every frame. Placed on whole pixels, it stood still for frames and
// then jumped a pixel.
describe("text moved by its layout moves continuously", () => {
  const W = 200;
  const H = 120;
  const FRAMES = 40;
  const STEP = 0.1;
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  const centroid = (element: React.ReactNode) =>
    renderWithCanvas(
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
            left: 20,
            top: 20,
            display: "flex",
            fontFamily: "Liberation Sans",
            fontWeight: 700,
            fontSize: 24,
            color: "#fff",
          }}
        >
          {element}
        </div>
      </div>,
      W,
      H,
      fonts,
    ).then(inkCentroid);

  // Each grows a length by STEP a frame, which moves the text by `rate` ×
  // STEP along `axis`.
  const animations: {
    name: string;
    axis: "x" | "y";
    rate: number;
    at: (length: number) => React.ReactNode;
  }[] = [
    {
      name: "padding-top",
      axis: "y",
      rate: 1,
      at: (length) => <div style={{ paddingTop: length }}>{"Hello"}</div>,
    },
    {
      name: "the height of a box it's centred in",
      axis: "y",
      rate: 0.5,
      at: (length) => (
        <div style={{ height: 40 + length, alignItems: "center" }}>
          {"Hello"}
        </div>
      ),
    },
    {
      name: "the width of an element before it",
      axis: "x",
      rate: 1,
      at: (length) => (
        <>
          <div style={{ width: 10 + length, height: 10 }} />
          {"Hello"}
        </>
      ),
    },
  ];

  it.each(animations)("as $name grows", async ({ name, axis, rate, at }) => {
    const first = await centroid(at(0));
    let previous = first;
    let jump = 0;
    let drift = 0;
    for (let i = 1; i <= FRAMES; i++) {
      const c = await centroid(at(i * STEP));
      jump = Math.max(jump, Math.abs(c[axis] - previous[axis] - rate * STEP));
      drift = Math.max(
        drift,
        Math.abs(c[axis] - first[axis] - rate * i * STEP),
      );
      previous = c;
    }
    console.log(
      `[comparison] ${name}: frame-to-frame jump ${jump.toFixed(3)}px, drift ${drift.toFixed(3)}px`,
    );
    // Off by ≤0.086px a frame, and ≤0.092px from where the layout puts it,
    // on macOS arm64 and Linux x64 alike. Placed on whole pixels, the text
    // jumped a pixel where its layout moved 0.05px or 0.1px, and was up to
    // 0.95px from it.
    expect(jump).toBeLessThan(0.25);
    expect(drift).toBeLessThan(0.25);
  });
});
