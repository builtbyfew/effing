import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReactNode } from "react";

import type { EmojiStyle } from "./jsx/emoji.ts";

export type { EmojiStyle };

/**
 * Font data for text rendering.
 * Compatible with `@effing/satori`'s FontData type.
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
  /** Font data for text rendering */
  fonts: FontData[];
  /** Layout width override. Defaults to `ctx.canvas.width`. */
  width?: number;
  /** Layout height override. Defaults to `ctx.canvas.height`. */
  height?: number;
  /** Draw layout bounding boxes for debugging */
  debug?: boolean;
  /** Emoji style for rendering emoji characters as images. Defaults to "twemoji". Pass "none" to disable. */
  emoji?: EmojiStyle | "none";
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
