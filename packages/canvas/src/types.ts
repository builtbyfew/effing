import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReactNode } from "react";

import type { EmojiStyle } from "./jsx/emoji.ts";
import type { ImageCache } from "./image.ts";

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
  /**
   * Cache for image loads — `<img>` and `background-image: url(...)` sources.
   * By default each call creates a fresh cache, so every source is fetched
   * and decoded anew per call. Pass a persistent cache (`new Map()`) when
   * calling repeatedly with the same sources — e.g. once per frame inside
   * `tween(...)` — so each source is loaded once, on first use. Sharing one
   * cache across concurrent calls is safe: entries are load promises, so
   * concurrent renders of the same source share a single in-flight fetch.
   * Failed loads are evicted and retried on the next call. The cache only
   * grows (successful loads are never evicted) — scope it to a bounded set
   * of sources, like one animation's frames, not a whole server's lifetime.
   */
  imageCache?: ImageCache;
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
