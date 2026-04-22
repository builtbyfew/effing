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
 *
 * Remote URLs (http/https) are fetched via global fetch() and passed to
 * loadImage as bytes. This lets callers install a global dispatcher
 * (e.g. undici's setGlobalDispatcher) to route image traffic through a
 * proxy — @napi-rs/canvas's own URL loader uses Node's raw http modules,
 * which bypass any dispatcher.
 */
export function cachedLoadImage(
  cache: ImageCache,
  src: string | Buffer,
): Promise<Image> {
  if (Buffer.isBuffer(src)) return loadImage(src);
  let entry = cache.get(src);
  if (!entry) {
    entry = isRemoteUrl(src) ? loadRemoteImage(src) : loadImage(src);
    cache.set(src, entry);
  }
  return entry;
}

function isRemoteUrl(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

async function loadRemoteImage(url: string): Promise<Image> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return loadImage(buffer);
}
