import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../../types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: SVG filter", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    const result = await loadFonts();
    fonts = result.fonts;
  }, 30_000);

  it("renders SVG filter — drop shadow via feOffset+feGaussianBlur+feColorMatrix+feBlend", async () => {
    const element = (
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
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          style={{ width: 200, height: 200 }}
        >
          <defs>
            <filter id="shadow">
              <feOffset in="SourceAlpha" dx={4} dy={4} result="offset" />
              <feGaussianBlur in="offset" stdDeviation={3} result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"
                result="shadow"
              />
              <feBlend in="SourceGraphic" in2="shadow" mode="normal" />
            </filter>
          </defs>
          <rect
            x={30}
            y={30}
            width={140}
            height={140}
            rx={12}
            fill="#3B82F6"
            filter="url(#shadow)"
          />
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-filter-drop-shadow",
    );
    expect(percentage).toBeLessThan(0.1);
  });
});
