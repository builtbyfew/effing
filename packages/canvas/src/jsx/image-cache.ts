import type { Image } from "@napi-rs/canvas";
import { loadImage } from "@napi-rs/canvas";

/**
 * Per-render cache of image load promises, keyed by source string.
 * Shared between layout and draw phases to avoid duplicate loads.
 */
export type ImageCache = Map<string, Promise<Image>>;

/**
 * Load an image, deduplicating by source string via the cache.
 * Buffer sources are never cached (no stable key).
 */
export function cachedLoadImage(
  cache: ImageCache,
  src: string | Buffer,
): Promise<Image> {
  if (Buffer.isBuffer(src)) return loadImage(src);
  let entry = cache.get(src);
  if (!entry) {
    entry = loadImage(src);
    cache.set(src, entry);
  }
  return entry;
}
