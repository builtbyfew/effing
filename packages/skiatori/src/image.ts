import { loadImage as skiaLoadImage } from "skia-canvas";
import type { Image } from "skia-canvas";

const imageCache = new Map<string, Promise<Image>>();

export async function loadImageFromSrc(src: string | Buffer): Promise<Image> {
  // Buffer sources can't be cached by key
  if (Buffer.isBuffer(src)) {
    return skiaLoadImage(src);
  }

  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = skiaLoadImage(src);
  imageCache.set(src, promise);
  return promise;
}
