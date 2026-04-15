import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: emoji", () => {
  let fonts: FontData[];
  let networkAvailable = true;

  beforeAll(async () => {
    fonts = await loadFonts();
    networkAvailable = await fetch("https://cdnjs.cloudflare.com", {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => r.ok)
      .catch(() => false);
  }, 5_000);

  it("renders emoji characters as images (twemoji)", async ({ skip }) => {
    if (!networkAvailable) skip();
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 40,
          backgroundColor: "white",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Liberation Sans",
        }}
      >
        <div style={{ fontSize: 48, color: "black" }}>Hello 🌍 World</div>
        <div style={{ fontSize: 32, color: "#666", marginTop: 20 }}>
          Stars ⭐⭐⭐
        </div>
        <div style={{ fontSize: 24, color: "#333", marginTop: 20 }}>
          Done 🎉
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts, "twemoji"),
      renderWithSatori(element, WIDTH, HEIGHT, fonts, "twemoji"),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "emoji-twemoji",
    );

    // Higher threshold due to SVG rasterization differences between Skia and resvg
    expect(percentage).toBeLessThan(2.5);
  });
});
