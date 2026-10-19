/**
 * Content type of an image format effing reads: PNG, JPEG or QOI.
 */
export type ImageContentType = "image/png" | "image/jpeg" | "image/qoi";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const QOI_MAGIC = [0x71, 0x6f, 0x69, 0x66]; // "qoif"
const QOI_HEADER_SIZE = 14;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, i) => bytes[i] === byte)
  );
}

/**
 * Detect a PNG, JPEG or QOI image from its first bytes.
 *
 * Checks the PNG signature (all 8 bytes), the JPEG start-of-image marker
 * followed by another marker (`FF D8 FF`), or the QOI magic (`qoif`). For
 * QOI, when the whole 14-byte header is there, its channel count must also
 * be 3 or 4 and its colorspace 0 or 1. Only these leading bytes are
 * checked, not whether the rest of the image is valid. Annie frames and fn
 * images carry no other record of their format, so this is how effing
 * tells them apart.
 *
 * @param bytes The image's bytes, or at least the first 8 of them (14 for
 *   QOI's header checks)
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
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  if (startsWith(bytes, QOI_MAGIC)) {
    if (bytes.length < QOI_HEADER_SIZE) return "image/qoi";
    const channels = bytes[12];
    const colorspace = bytes[13];
    if ((channels === 3 || channels === 4) && colorspace <= 1) {
      return "image/qoi";
    }
  }
  return undefined;
}
