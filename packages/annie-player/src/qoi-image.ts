import { decodeQoi, isQoi, readQoiHeader } from "./qoi";

/**
 * Convert a QOI image to a PNG `Blob`, which browsers can show, for
 * example through an object URL in an `<img>`.
 *
 * Browser-only: the pixels are drawn on an `OffscreenCanvas`, or on a canvas
 * element where `OffscreenCanvas` has no 2D context.
 *
 * @param bytes - The complete QOI file
 * @throws Error if the bytes aren't a valid QOI image
 */
export async function qoiToPngBlob(bytes: Uint8Array): Promise<Blob> {
  const { width, height } = readQoiHeader(bytes);

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (context) {
      const imageData = context.createImageData(width, height);
      decodeQoi(bytes, imageData.data);
      context.putImageData(imageData, 0, 0);
      return canvas.convertToBlob({ type: "image/png" });
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a canvas to convert a QOI image on");
  }
  const imageData = context.createImageData(width, height);
  decodeQoi(bytes, imageData.data);
  context.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode a QOI image as PNG"));
    }, "image/png");
  });
}

/**
 * Fetch an image and, if it's QOI, convert it to PNG and return an object
 * URL for it. Revoke the URL with `URL.revokeObjectURL()` once it's no
 * longer shown.
 *
 * QOI is detected from the bytes, not the URL or the content type. Fetching
 * a cross-origin image needs CORS, unlike showing it in an `<img>`.
 *
 * @param url - The image URL
 * @param init - Options for `fetch()`, such as an abort `signal`
 * @returns An object URL for the PNG, or `null` if the image isn't QOI
 * @throws Error if the fetch fails or the QOI image is invalid
 */
export async function fetchQoiAsPngUrl(
  url: string,
  init?: RequestInit,
): Promise<string | null> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isQoi(bytes)) return null;
  return URL.createObjectURL(await qoiToPngBlob(bytes));
}
