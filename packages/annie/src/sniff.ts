/**
 * Content type of an image format effing reads: PNG, JPEG or QOI.
 */
export type ImageContentType = "image/png" | "image/jpeg" | "image/qoi";

/**
 * Detect a PNG, JPEG or QOI image from its first bytes.
 *
 * Only the magic bytes are checked, not whether the rest of the image is
 * valid. Annie frames and fn images carry no other record of their format,
 * so this is how effing tells them apart.
 *
 * @param bytes The image's bytes, or at least the first four of them
 * @returns The image's content type, or `undefined` for anything else
 *
 * @example
 * ```ts
 * sniffImageContentType(await canvas.encode("qoi")); // "image/qoi"
 * ```
 */
export function sniffImageContentType(
  bytes: Uint8Array,
): ImageContentType | undefined {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  // "qoif"
  if (
    bytes[0] === 0x71 &&
    bytes[1] === 0x6f &&
    bytes[2] === 0x69 &&
    bytes[3] === 0x66
  ) {
    return "image/qoi";
  }
  return undefined;
}
