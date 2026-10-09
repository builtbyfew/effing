import { describe, expect, it } from "vitest";

import { createCanvas, renderReactElement } from "../../index.ts";

/** An SVG image of the given size, as a data URI. */
function svgImage(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="red"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

describe("url() background of a zero-size image", () => {
  // A zero-size tile used to step the tiling loops by 0, never ending.
  it.each([
    [0, 10, undefined, undefined],
    [10, 0, undefined, undefined],
    [0, 0, undefined, undefined],
    [0, 10, "repeat-x", undefined],
    [10, 0, "repeat-y", undefined],
    [0, 10, undefined, "contain"],
    [0, 0, undefined, "contain"],
  ])(
    "renders a %i×%i image (repeat %s, size %s) without painting it",
    async (imageWidth, imageHeight, backgroundRepeat, backgroundSize) => {
      const canvas = createCanvas(20, 20);
      const ctx = canvas.getContext("2d");
      await renderReactElement(
        ctx,
        <div
          style={{
            display: "flex",
            width: 20,
            height: 20,
            backgroundColor: "white",
            backgroundImage: `url(${svgImage(imageWidth, imageHeight)})`,
            backgroundRepeat,
            backgroundSize,
          }}
        />,
        {},
      );

      const { data } = ctx.getImageData(0, 0, 20, 20);
      for (let i = 0; i < data.length; i += 4) {
        expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([
          255, 255, 255, 255,
        ]);
      }
    },
  );
});
