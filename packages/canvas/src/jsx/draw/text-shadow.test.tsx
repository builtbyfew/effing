import { describe, expect, it } from "vitest";

import { BUNDLED_SANS, loadFonts } from "../../../comparison/_helpers/fonts.ts";
import { createCanvas, renderReactElement } from "../../index.ts";

describe("text-shadow", () => {
  it("shows nothing of the text casting it under a drop-shadow filter", async () => {
    // The text casting a shadow is drawn off the canvas; a drop shadow cast
    // far back left must not bring it into view.
    const canvas = createCanvas(300, 100);
    const ctx = canvas.getContext("2d");
    await renderReactElement(
      ctx,
      <div
        style={{
          display: "flex",
          width: 300,
          height: 100,
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 30,
            fontFamily: BUNDLED_SANS,
            fontSize: 28,
            color: "#000",
            textShadow: "1px 1px 0 red",
            filter: "drop-shadow(-120px 0 0 blue)",
          }}
        >
          Shadow
        </div>
      </div>,
      { fonts: await loadFonts(BUNDLED_SANS) },
    );
    const { data } = ctx.getImageData(0, 0, 300, 100);
    let drawn = 0;
    let blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r < 250 || g < 250 || b < 250) drawn++;
      if (b > 150 && r < 100 && g < 100) blue++;
    }
    // The text and its drop shadow are drawn...
    expect(drawn).toBeGreaterThan(100);
    // ...but only one drop shadow, the text's own, 120px left of it.
    const right = (x: number) => {
      let n = 0;
      for (let y = 0; y < 100; y++) {
        const i = (y * 300 + x) * 4;
        if (data[i + 2]! > 150 && data[i]! < 100 && data[i + 1]! < 100) n++;
      }
      return n;
    };
    let ghost = 0;
    for (let x = 280; x < 300; x++) ghost += right(x);
    expect(blue).toBeGreaterThan(0);
    expect(ghost).toBe(0);
  });
});
