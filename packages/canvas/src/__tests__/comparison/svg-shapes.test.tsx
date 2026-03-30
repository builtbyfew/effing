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

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: SVG shapes", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it("renders SVG rect with rx — rounded corners", async () => {
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
          <rect x={10} y={10} width={180} height={80} rx={12} fill="#3B82F6" />
          <rect x={10} y={110} width={180} height={80} rx={40} fill="#EF4444" />
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
      "svg-rect-rx-rounded",
    );
    expect(percentage).toBeLessThan(1);
  });

  it("renders SVG group transforms — nested <g> with translate", async () => {
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
            <clipPath id="houseClip">
              <rect x={0} y={0} width={80} height={80} />
            </clipPath>
          </defs>
          <g transform="translate(60, 60)">
            <g transform="translate(10, 10)">
              <polygon
                points="40,0 80,40 0,40"
                fill="#EF4444"
                clipPath="url(#houseClip)"
              />
              <rect x={10} y={40} width={60} height={40} fill="#3B82F6" />
            </g>
          </g>
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
      "svg-group-transform",
    );
    expect(percentage).toBeLessThan(1);
  });
});
