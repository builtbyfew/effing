import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

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
 * Emoji style options for rendering
 */
export type EmojiStyle =
  | "twemoji"
  | "openmoji"
  | "blobmoji"
  | "noto"
  | "fluent"
  | "fluentFlat";

const emojiApis: Record<EmojiStyle, string | ((code: string) => string)> = {
  twemoji: (code: string) =>
    `https://cdnjs.cloudflare.com/ajax/libs/twemoji/16.0.1/svg/${code.toLowerCase()}.svg`,
  openmoji: "https://cdn.jsdelivr.net/npm/@svgmoji/openmoji@2.0.0/svg/",
  blobmoji: "https://cdn.jsdelivr.net/npm/@svgmoji/blob@2.0.0/svg/",
  noto: "https://cdn.jsdelivr.net/gh/svgmoji/svgmoji/packages/svgmoji__noto/svg/",
  fluent: (code: string) =>
    `https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${code.toLowerCase()}_color.svg`,
  fluentFlat: (code: string) =>
    `https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${code.toLowerCase()}_flat.svg`,
};

const U200D = String.fromCharCode(8205);
const UFE0Fg = /\uFE0F/g;

function getEmojiCode(char: string): string {
  return toCodePoint(char.indexOf(U200D) < 0 ? char.replace(UFE0Fg, "") : char);
}

function toCodePoint(unicodeSurrogates: string): string {
  const r: string[] = [];
  let c = 0,
    p = 0,
    i = 0;

  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++);
    if (p) {
      r.push((65536 + ((p - 55296) << 10) + (c - 56320)).toString(16));
      p = 0;
    } else if (55296 <= c && c <= 56319) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  return r.join("-");
}

const emojiCache: Record<string, Promise<string>> = {};

async function loadEmoji(type: EmojiStyle, code: string): Promise<string> {
  const key = type + ":" + code;
  if (key in emojiCache) return emojiCache[key];

  const api = emojiApis[type];
  if (typeof api === "function") {
    return (emojiCache[key] = fetch(api(code)).then((r) => r.text()));
  }
  return (emojiCache[key] = fetch(`${api}${code.toUpperCase()}.svg`).then((r) =>
    r.text(),
  ));
}

/**
 * Options for pngFromSatori
 */
export type PngFromSatoriOptions = {
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
  { width, height, fonts, emoji = "twemoji" }: PngFromSatoriOptions,
): Promise<Buffer> {
  const overlaySvg = await satori(template, {
    width,
    height,
    fonts,
    loadAdditionalAsset: async (code: string, segment: string) => {
      if (code === "emoji") {
        return (
          "data:image/svg+xml;base64," +
          btoa(await loadEmoji(emoji, getEmojiCode(segment)))
        );
      }
      return segment;
    },
  });
  const resvg = new Resvg(overlaySvg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}
