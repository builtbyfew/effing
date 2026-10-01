import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
} from "./_helpers/setup.ts";

// An element's opacity and filter apply to it and its descendants as one
// compositing group, as in CSS, rather than to each draw. Every case here
// comes out differently when they are applied per draw.
describe.skipIf(!HAS_NATIVE_DEPS)("compositing groups", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  const render = async (element: React.ReactElement) =>
    PNG.sync.read(await renderWithCanvas(element, 300, 200, fonts));

  const pixel = (img: PNG, x: number, y: number) =>
    Array.from(
      img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4),
    );

  const box = (left: number, top: number, background: string) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 100,
        height: 100,
        background,
      }}
    />
  );

  it("fades overlapping children as one group under opacity", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.5,
          }}
        >
          {box(20, 20, "#2563eb")}
          {box(70, 60, "#2563eb")}
        </div>
      </div>,
    );
    // Inside the overlap, and inside only the first box.
    expect(pixel(img, 90, 90)).toEqual(pixel(img, 30, 30));
  });

  it("multiplies the opacity of nested groups", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.5,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 20,
              width: 100,
              height: 100,
              background: "#000",
              opacity: 0.5,
            }}
          />
        </div>
      </div>,
    );
    // Black at 0.5 × 0.5 over white: 255 × 0.75.
    const [r, g, b] = pixel(img, 60, 60);
    for (const channel of [r, g, b]) {
      expect(Math.abs(channel! - 191)).toBeLessThanOrEqual(1);
    }
  });

  it("casts one drop-shadow for the whole group", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            filter: "drop-shadow(-10px 10px 0px #f00)",
          }}
        >
          {box(20, 20, "#fff")}
          {box(70, 20, "#fff")}
        </div>
      </div>,
    );
    // The second box's shadow falls on the visible strip of the first box
    // (x 60–70): per draw, it's painted over that box; as a group, the
    // union casts one shadow behind both.
    expect(pixel(img, 65, 60)).toEqual([255, 255, 255, 255]);
    // The group's shadow itself, below the boxes.
    expect(pixel(img, 100, 125)).toEqual([255, 0, 0, 255]);
  });

  it("scales a filter with the element's transform", async () => {
    // A hard 4px shadow under scale(2) falls 8 device pixels below the box.
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 50,
            height: 40,
            background: "#fff",
            filter: "drop-shadow(0px 4px 0px #f00)",
            transform: "scale(2)",
            transformOrigin: "left top",
          }}
        />
      </div>,
    );
    // The box spans y 50–130; its shadow shows from 130 to 138.
    expect(pixel(img, 150, 134)).toEqual([255, 0, 0, 255]);
    expect(pixel(img, 150, 142)).toEqual([255, 255, 255, 255]);
  });

  it("keeps everything a clipping element paints inside its bounded group", async () => {
    // A translucent element that clips its content gets a group sized to its
    // border box and box-shadow. Fading the element rendered on its own must
    // give the same picture: nothing of the shadow or of the anti-aliased
    // edges may be cut, also under a rotation and a scale.
    const scene = (background: string | undefined, opacity: number) => (
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 80.3,
            top: 50.7,
            width: 120,
            height: 70,
            display: "flex",
            borderRadius: 16,
            overflow: "hidden",
            background: "#f97316",
            boxShadow: "6px 8px 10px #000",
            transform: "rotate(8deg) scale(1.2)",
            opacity,
          }}
        >
          {box(70, 20, "#2563eb")}
        </div>
      </div>
    );
    const [actual, alone] = await Promise.all([
      render(scene("#fff", 0.5)),
      render(scene(undefined, 1)),
    ]);

    // Opacity is quantized to 8 bits, as globalAlpha is.
    const alpha = Math.round(0.5 * 255) / 255;
    let painted = 0;
    let worst = 0;
    for (let i = 0; i < actual.data.length; i += 4) {
      const coverage = (alone.data[i + 3]! / 255) * alpha;
      if (coverage > 0) painted++;
      for (let c = 0; c < 3; c++) {
        const expected = 255 + (alone.data[i + c]! - 255) * coverage;
        worst = Math.max(worst, Math.abs(actual.data[i + c]! - expected));
      }
    }
    // The element and its shadow cover a good part of the frame.
    expect(painted).toBeGreaterThan(15_000);
    expect(worst).toBeLessThanOrEqual(2);
  });

  it("reads a backdrop only from within its backdrop root", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#000",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.9,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 50,
              top: 50,
              width: 100,
              height: 100,
              backdropFilter: "invert(1)",
            }}
          />
        </div>
      </div>,
    );
    // The black canvas is behind the opacity group, not in it, so there is
    // nothing to invert: CSS leaves it black, where filtering the canvas
    // would turn it white.
    expect(pixel(img, 100, 100).slice(0, 3)).toEqual([0, 0, 0]);
  });
});
