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

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: SVG defs", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    const result = await loadFonts();
    fonts = result.fonts;
  }, 30_000);

  it("renders SVG clipPath — circle clip applied to a rect", async () => {
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
            <clipPath id="circleClip">
              <circle cx={100} cy={100} r={80} />
            </clipPath>
          </defs>
          <rect
            x={0}
            y={0}
            width={200}
            height={200}
            fill="#3B82F6"
            clipPath="url(#circleClip)"
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
      "svg-clip-path",
    );
    expect(percentage).toBeLessThan(1);
  });

  it("svg-multi-path-cliprule", async () => {
    const WIDTH = 200;
    const HEIGHT = 200;

    // Multiple sibling paths with clipRule="evenodd" — all should render
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
          width={180}
          height={180}
          viewBox="0 0 180 180"
          style={{ width: 180, height: 180 }}
        >
          <path d="M10,10 h50 v50 h-50 Z" fill="#E11D48" clipRule="evenodd" />
          <path d="M70,10 h50 v50 h-50 Z" fill="#2563EB" clipRule="evenodd" />
          <path d="M10,70 h50 v50 h-50 Z" fill="#16A34A" clipRule="evenodd" />
          <path d="M70,70 h50 v50 h-50 Z" fill="#D97706" clipRule="evenodd" />
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
      "svg-multi-path-cliprule",
    );
    expect(percentage).toBeLessThan(1);
  });

  it("renders SVG mask — masked path clipping", async () => {
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
            <mask id="circleMask">
              <circle cx={100} cy={100} r={80} fill="white" />
            </mask>
          </defs>
          <rect
            x={0}
            y={0}
            width={200}
            height={200}
            fill="#3B82F6"
            mask="url(#circleMask)"
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
      "svg-mask-clipping",
    );
    expect(percentage).toBeLessThan(2);
  });

  it("renders SVG mask — top-level mask outside defs", async () => {
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
          <mask id="topLevelMask">
            <rect x={0} y={0} width={200} height={100} fill="white" />
          </mask>
          <circle
            cx={100}
            cy={100}
            r={80}
            fill="#EF4444"
            mask="url(#topLevelMask)"
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
      "svg-mask-top-level",
    );
    expect(percentage).toBeLessThan(0.1);
  });
});
