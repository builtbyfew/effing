import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type React from "react";
import type { FontData } from "../../src/types.ts";

export async function renderWithCanvas(
  element: React.ReactNode,
  width: number,
  height: number,
  fonts: FontData[],
  emoji?: import("../../src/jsx/emoji.ts").EmojiStyle | "none",
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { renderReactElement } = await import("../../src/jsx/index.ts");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await renderReactElement(ctx, element, { fonts, emoji });
  return canvas.encode("png");
}

export async function renderWithSatori(
  element: React.ReactNode,
  width: number,
  height: number,
  fonts: FontData[],
  emoji?: import("../../src/jsx/emoji.ts").EmojiStyle | "none",
): Promise<Buffer> {
  const satori = (await import("satori")).default;
  const { Resvg } = await import("@resvg/resvg-js");
  const opts: Parameters<typeof satori>[1] = { width, height, fonts };
  if (emoji && emoji !== "none") {
    const { loadEmoji, getEmojiCode } = await import("../../src/jsx/emoji.ts");
    opts.loadAdditionalAsset = async (code: string, segment: string) => {
      if (code === "emoji") {
        return (
          "data:image/svg+xml;base64," +
          btoa(await loadEmoji(emoji, getEmojiCode(segment)))
        );
      }
      return segment;
    };
  }
  const svg = await satori(element, opts);
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

export async function compareImages(
  canvasPng: Buffer,
  satoriPng: Buffer,
  label: string,
  threshold = 0.1,
) {
  const pixelmatch = (await import("pixelmatch")).default;
  const { PNG } = await import("pngjs");

  const img1 = PNG.sync.read(canvasPng);
  const img2 = PNG.sync.read(satoriPng);

  const { width, height } = img1;
  const debug = !!process.env.COMPARISON_DEBUG;
  const diff = debug ? new PNG({ width, height }) : null;

  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff?.data ?? null,
    width,
    height,
    { threshold },
  );

  const totalPixels = width * height;
  const percentage = (diffPixels / totalPixels) * 100;

  if (debug && diff) {
    const debugDir = join(tmpdir(), "effing-comparison-debug");
    mkdirSync(debugDir, { recursive: true });
    const slug = label.replace(/\s+/g, "-").toLowerCase();
    writeFileSync(join(debugDir, `${slug}-canvas.png`), canvasPng);
    writeFileSync(join(debugDir, `${slug}-satori.png`), satoriPng);
    writeFileSync(join(debugDir, `${slug}-diff.png`), PNG.sync.write(diff));
    console.log(
      `${label}: ${percentage.toFixed(2)}% diff (${diffPixels}/${totalPixels}) — ${debugDir}/${slug}-*.png`,
    );
  }

  return { diffPixels, totalPixels, percentage };
}

export async function makeTestImage(w: number, h: number): Promise<string> {
  const { PNG } = await import("pngjs");
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      png.data[i] = Math.floor((x / w) * 255); // R gradient
      png.data[i + 1] = Math.floor((y / h) * 255); // G gradient
      png.data[i + 2] = 128; // B constant
      png.data[i + 3] = 255; // A opaque
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}
