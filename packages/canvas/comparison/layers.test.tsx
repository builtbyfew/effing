import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
} from "./_helpers/setup.ts";

// Compositing groups through the @effing/skia layer primitive
// (EFFING_LAYERS=1): opacity and filter apply to an element and its
// descendants as one group, as in CSS, rather than to each draw.
describe.skipIf(!HAS_NATIVE_DEPS || process.env.EFFING_LAYERS !== "1")(
  "native layers",
  () => {
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
              opacity: 0.999,
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
  },
);
