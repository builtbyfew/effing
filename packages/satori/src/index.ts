import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { makeLoadAdditionalAsset } from "./emoji.ts";
import type { EmojiStyle } from "./emoji.ts";

export type { EmojiStyle } from "./emoji.ts";

/**
 * Font data for satori rendering
 */
export type FontData = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

/**
 * Options for satori rendering functions
 */
export type SatoriOptions = {
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Font data for text rendering */
  fonts: FontData[];
  /** Emoji style to use (default: "twemoji") */
  emoji?: EmojiStyle;
};

/**
 * @deprecated Use `SatoriOptions` instead
 */
export type PngFromSatoriOptions = SatoriOptions;

/**
 * Render a React/JSX template to an SVG string using Satori
 *
 * @param template React element to render
 * @param options Rendering options
 * @returns SVG markup as a string
 */
export async function svgFromSatori(
  template: Parameters<typeof satori>[0],
  { width, height, fonts, emoji = "twemoji" }: SatoriOptions,
): Promise<string> {
  return satori(template, {
    width,
    height,
    fonts,
    loadAdditionalAsset: makeLoadAdditionalAsset(emoji),
  });
}

/**
 * Rasterize an SVG string to a PNG buffer using Resvg
 *
 * @param svg SVG markup string
 * @returns PNG image as a Buffer
 */
export function rasterizeSvg(svg: string): Buffer {
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

/**
 * Render a React/JSX template to a PNG buffer using Satori
 *
 * @param template React element to render
 * @param options Rendering options
 * @returns PNG image as a Buffer
 *
 * @example
 * ```tsx
 * const png = await pngFromSatori(
 *   <div style={{ fontSize: 48, color: "white" }}>Hello World</div>,
 *   { width: 1080, height: 1080, fonts: [myFont] }
 * );
 * ```
 */
export async function pngFromSatori(
  template: Parameters<typeof satori>[0],
  options: SatoriOptions,
): Promise<Buffer> {
  const svg = await svgFromSatori(template, options);
  return rasterizeSvg(svg);
}
