import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import { emojiUrl } from "../src/jsx/emoji.ts";
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
    // An image the renderer fetches, from the same CDN.
    networkAvailable = await fetch(emojiUrl("twemoji", "🌍"), {
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

  it("draws a flag as an image (twemoji)", async ({ skip }) => {
    if (!networkAvailable) skip();
    // 🇧🇪 at 80px, its box's left edge at 40px and top at 40px.
    const element = (
      <div
        style={{
          display: "flex",
          padding: 40,
          backgroundColor: "white",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Liberation Sans",
          fontSize: 80,
          lineHeight: 1,
        }}
      >
        {"\u{1F1E7}\u{1F1EA}"}
      </div>
    );
    const png = PNG.sync.read(
      await renderWithCanvas(element, WIDTH, HEIGHT, fonts, "twemoji"),
    );
    // Twemoji's flag is black, yellow and red bands, left to right.
    const pixel = (x: number, y: number) => {
      const i = (y * png.width + x) * 4;
      return [...png.data.subarray(i, i + 3)];
    };
    const [black, yellow, red] = [53, 80, 107].map((x) => pixel(x, 80));
    expect(black!.every((c) => c < 64)).toBe(true);
    expect(yellow![0]! > 200 && yellow![1]! > 180 && yellow![2]! < 120).toBe(
      true,
    );
    expect(red![0]! > 200 && red![1]! < 100 && red![2]! < 100).toBe(true);
  });

  // Text by default, but outside the BMP, where no text font covers them:
  // Chrome draws them as emoji even without U+FE0F.
  it("draws text-default emoji outside the BMP as images (twemoji)", async ({
    skip,
  }) => {
    if (!networkAvailable) skip();
    const element = (
      <div
        style={{
          display: "flex",
          padding: 40,
          backgroundColor: "white",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Liberation Sans",
          fontSize: 80,
        }}
      >
        {"\u{1F575} \u{1F3F3}"}
      </div>
    );
    const png = PNG.sync.read(
      await renderWithCanvas(element, WIDTH, HEIGHT, fonts, "twemoji"),
    );
    // Pixels close to a colour of twemoji's images.
    const count = ([r, g, b]: number[]) => {
      let n = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const near = (c: number, j: number) => Math.abs(png.data[i + j]! - c);
        if (near(r!, 0) + near(g!, 1) + near(b!, 2) < 24) n++;
      }
      return n;
    };
    // The detective's face, #FFDC5D, and the white flag's cloth, #E1E8ED.
    expect(count([0xff, 0xdc, 0x5d])).toBeGreaterThan(40);
    expect(count([0xe1, 0xe8, 0xed])).toBeGreaterThan(1000);
  });

  // A ZWJ or ZWNJ shapes the letters around it, and symbols that Unicode
  // presents as text by default stay text: none of them takes an emoji's box.
  it("lays text joined by a ZWJ, and text symbols, out as text", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 20,
          backgroundColor: "white",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Liberation Sans",
          fontSize: 32,
          color: "black",
        }}
      >
        <div>{"a\u200Db a\u200Cb"}</div>
        <div>{"\u0644\u200D \u0628\u200D\u0628"}</div>
        <div>{"\u0915\u094D\u200D\u0937 \u0915\u094D\u200C\u0937"}</div>
        <div>{"\u00A9 \u2713 \u25CF \u260E 1"}</div>
      </div>
    );
    const [withEmoji, withoutEmoji] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts, "twemoji"),
      renderWithCanvas(element, WIDTH, HEIGHT, fonts, "none"),
    ]);
    const { diffPixels } = await compareImages(
      withEmoji,
      withoutEmoji,
      "emoji-zwj-text",
      0,
    );
    expect(diffPixels).toBe(0);
  });
});
