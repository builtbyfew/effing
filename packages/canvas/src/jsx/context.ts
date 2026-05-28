import type { ImageCache } from "../image.ts";

/**
 * Per-render configuration and shared state, created once per
 * `renderReactElement` call and threaded through the layout and draw phases.
 *
 * This is the home for cross-cutting render settings so they don't have to be
 * passed as a growing list of positional parameters or smuggled onto the image
 * cache. Add future per-render fetch/diagnostic options here.
 */
export type RenderContext = {
  /** Dedup cache for image loads, shared across the layout and draw phases. */
  imageCache: ImageCache;
  /** User-Agent header for remote (http/https) image fetches. */
  userAgent?: string;
  /** Emit diagnostics — currently warns when an image fails to load. */
  debug: boolean;
};
