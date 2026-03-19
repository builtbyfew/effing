import type { SKRSContext2D } from "@napi-rs/canvas";

import type { ImageCache } from "../image-cache.ts";
import { cachedLoadImage } from "../image-cache.ts";
import type { ComputedStyle } from "../style/compute.ts";
import { computeContain, computeCover } from "./object-fit.ts";

/**
 * Draw an image element onto the canvas.
 *
 * @param ctx - Canvas rendering context
 * @param src - Image source (URL, file path, or Buffer)
 * @param x - X position
 * @param y - Y position
 * @param width - Target width
 * @param height - Target height
 * @param imageCache - Image load cache
 * @param style - Computed style (for objectFit)
 */
export async function drawImage(
  ctx: SKRSContext2D,
  src: string | Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  imageCache: ImageCache,
  style?: ComputedStyle,
): Promise<void> {
  const image = await cachedLoadImage(imageCache, src);
  const objectFit = style?.objectFit ?? "fill";

  if (objectFit === "fill") {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  const imgW = image.width;
  const imgH = image.height;

  if (objectFit === "contain") {
    const r = computeContain(imgW, imgH, x, y, width, height);
    ctx.drawImage(image, r.dx, r.dy, r.dw, r.dh);
  } else if (objectFit === "cover") {
    const r = computeCover(imgW, imgH, x, y, width, height);
    ctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  } else if (objectFit === "none") {
    const dx = x + (width - imgW) / 2;
    const dy = y + (height - imgH) / 2;
    ctx.drawImage(image, dx, dy);
  } else if (objectFit === "scale-down") {
    if (imgW <= width && imgH <= height) {
      const dx = x + (width - imgW) / 2;
      const dy = y + (height - imgH) / 2;
      ctx.drawImage(image, dx, dy);
    } else {
      const r = computeContain(imgW, imgH, x, y, width, height);
      ctx.drawImage(image, r.dx, r.dy, r.dw, r.dh);
    }
  }
}
