import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReactNode } from "react";

import type { EmojiStyle } from "./jsx/emoji.ts";

export type { EmojiStyle };

/**
 * Font data for text rendering.

 */
export type FontData = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

/**
 * Options for {@link renderReactElement}.
 */
export type RenderReactElementOptions = {
  /** Font data for text rendering. Defaults to `[]` (system fonts). */
  fonts?: FontData[];
  /** Layout width override. Defaults to `ctx.canvas.width`. */
  width?: number;
  /** Layout height override. Defaults to `ctx.canvas.height`. */
  height?: number;
  /** Draw layout bounding boxes for debugging */
  debug?: boolean;
  /** Emoji style for rendering emoji characters as images. Defaults to "twemoji". Pass "none" to disable. */
  emoji?: EmojiStyle | "none";
  /**
   * User-Agent header sent on remote (http/https) image fetches — `<img>` and
   * `background-image: url(...)` sources. When unset, fetch uses its default.
   * An empty string is passed through as an explicit empty header. Values
   * containing CR/LF or other invalid header characters will cause fetch to
   * throw `TypeError`. (Emoji sprites are fetched from public CDNs without
   * this header.)
   */
  userAgent?: string;
};

/**
 * A React element that can be rendered to a canvas context.
 * Same input type as satori.
 */
export type RenderableElement = ReactNode;

/**
 * Canvas context type re-exported for convenience.
 */
export type { SKRSContext2D };
