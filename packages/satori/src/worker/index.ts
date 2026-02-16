import { Resvg } from "@resvg/resvg-js";
import satori, { type Font } from "satori";

import type { EmojiStyle } from "../emoji.ts";
import { makeLoadAdditionalAsset } from "../emoji.ts";
import { deserializeElement, ensureSingleElement } from "../serde/index.ts";

export async function renderToPng({
  element,
  width,
  height,
  fonts,
  emoji = "twemoji",
}: {
  element: unknown;
  width: number;
  height: number;
  fonts: Array<{ name: string; data: Buffer; weight: number; style: string }>;
  emoji?: EmojiStyle;
}): Promise<Uint8Array> {
  const reactElement = ensureSingleElement(
    deserializeElement(element),
  ) as Parameters<typeof satori>[0];
  const svg = await satori(reactElement, {
    width,
    height,
    fonts: fonts as Font[],
    loadAdditionalAsset: makeLoadAdditionalAsset(emoji),
  });
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

export async function renderToSvg({
  element,
  width,
  height,
  fonts,
  emoji = "twemoji",
}: {
  element: unknown;
  width: number;
  height: number;
  fonts: Array<{ name: string; data: Buffer; weight: number; style: string }>;
  emoji?: EmojiStyle;
}): Promise<string> {
  const reactElement = ensureSingleElement(
    deserializeElement(element),
  ) as Parameters<typeof satori>[0];
  return satori(reactElement, {
    width,
    height,
    fonts: fonts as Font[],
    loadAdditionalAsset: makeLoadAdditionalAsset(emoji),
  });
}

export async function rasterizeSvgToPng({
  svg,
  options,
}: {
  svg: string;
  options?: {
    fitTo?:
      | { mode: "original" }
      | { mode: "width"; value: number }
      | { mode: "height"; value: number }
      | { mode: "zoom"; value: number };
    crop?: {
      left: number;
      top: number;
      right?: number;
      bottom?: number;
    };
  };
}): Promise<Uint8Array> {
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false },
    ...options,
  });
  return resvg.render().asPng();
}
