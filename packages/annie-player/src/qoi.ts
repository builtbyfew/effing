/**
 * QOI ("Quite OK Image") decoder, written from the specification at
 * https://qoiformat.org/qoi-specification.pdf.
 *
 * Browsers can't decode QOI natively, so annie frames and still images in
 * that format are decoded here, into RGBA pixels that fit an `ImageData`.
 * The decoder is plain TypeScript with no DOM dependencies.
 */

/** Information from a QOI header. */
export type QoiHeader = {
  width: number;
  height: number;
  /** 3 (RGB) or 4 (RGBA). Informational only: it doesn't change decoding. */
  channels: 3 | 4;
  /** 0 (sRGB with linear alpha) or 1 (all channels linear). Informational only. */
  colorspace: 0 | 1;
};

/** A decoded QOI image. */
export type QoiImage = QoiHeader & {
  /** RGBA pixels, row by row, 4 bytes per pixel, suitable for `ImageData`. */
  data: Uint8ClampedArray;
};

/**
 * The largest image, in pixels, that {@link decodeQoi} accepts: 8192 × 8192,
 * or 256 MiB of RGBA output.
 *
 * The reference implementation allows 400 million pixels (1.6 GB of RGBA),
 * more than a browser can show: decoded pixels are drawn through a canvas,
 * and browsers cap a canvas's area (Chrome at 268 million pixels, Safari on
 * iOS at 16.7 million). 8192² covers 8K UHD (7680 × 4320) with room to spare
 * while keeping the largest allocation a header can ask for to 256 MiB.
 */
export const QOI_MAX_PIXELS = 8192 * 8192;

const HEADER_SIZE = 14;
const END_MARKER_SIZE = 8;
/** The longest run a single QOI_OP_RUN encodes. */
const MAX_RUN = 62;

/**
 * Whether the bytes start with the QOI magic, `qoif`. Says nothing about
 * whether the rest of the image is valid.
 */
export function isQoi(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x71 && // q
    bytes[1] === 0x6f && // o
    bytes[2] === 0x69 && // i
    bytes[3] === 0x66 // f
  );
}

/**
 * Read and validate a QOI header without decoding any pixels.
 *
 * Besides the fields themselves, this checks that the data is long enough to
 * hold the image at all (one byte encodes at most 62 pixels), so a corrupt
 * header can't make a decoder allocate far more than the data could describe.
 *
 * @throws Error if the header is missing or malformed, describes an image
 *   larger than {@link QOI_MAX_PIXELS}, or the data is too short for it
 */
export function readQoiHeader(bytes: Uint8Array): QoiHeader {
  if (!isQoi(bytes)) {
    throw new Error("Invalid QOI image: missing qoif magic");
  }
  if (bytes.length < HEADER_SIZE + END_MARKER_SIZE) {
    throw new Error("Invalid QOI image: data is truncated");
  }
  const width =
    ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) >>> 0;
  const height =
    ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) >>> 0;
  const channels = bytes[12];
  const colorspace = bytes[13];
  if (width === 0 || height === 0) {
    throw new Error(`Invalid QOI image: size is ${width}×${height}`);
  }
  if (channels !== 3 && channels !== 4) {
    throw new Error(`Invalid QOI image: ${channels} channels`);
  }
  if (colorspace !== 0 && colorspace !== 1) {
    throw new Error(`Invalid QOI image: colorspace ${colorspace}`);
  }
  const pixels = width * height;
  if (pixels > QOI_MAX_PIXELS) {
    throw new Error(
      `QOI image is too large: ${width}×${height} exceeds ${QOI_MAX_PIXELS} pixels`,
    );
  }
  const minLength = HEADER_SIZE + Math.ceil(pixels / MAX_RUN) + END_MARKER_SIZE;
  if (bytes.length < minLength) {
    throw new Error("Invalid QOI image: data is truncated");
  }
  return { width, height, channels, colorspace };
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/**
 * Decode a QOI image to RGBA pixels.
 *
 * Both 3- and 4-channel images decode to 4 bytes per pixel; a 3-channel
 * image's pixels are opaque. The colorspace is reported but not applied.
 *
 * @param bytes - The complete QOI file
 * @param output - Optional buffer to decode into, such as a reused
 *   `ImageData`'s `data`. It must hold exactly `width × height × 4` bytes.
 *   When omitted, a new buffer is allocated.
 * @throws Error if the data isn't a valid QOI image, is truncated, or
 *   `output` has the wrong size
 */
export function decodeQoi(
  bytes: Uint8Array,
  output?: Uint8ClampedArray,
): QoiImage {
  const header = readQoiHeader(bytes);
  const pixelCount = header.width * header.height;
  const data = output ?? new Uint8ClampedArray(pixelCount * 4);
  if (data.length !== pixelCount * 4) {
    throw new Error(
      `QOI output buffer holds ${data.length} bytes, expected ${pixelCount * 4}`,
    );
  }
  if (data.byteOffset % 4 !== 0) {
    throw new Error("QOI output buffer must start at a multiple of 4 bytes");
  }
  decodeChunks(bytes, new Int32Array(data.buffer, data.byteOffset, pixelCount));
  return { ...header, data };
}

/**
 * The decoding loop. Each pixel is packed into one 32-bit word, R in the low
 * byte and A in the high one, so a little-endian Int32Array over the output
 * stores R, G, B, A in a single write. (Int32 rather than Uint32 keeps every
 * value a small integer for V8; this measured ~10-30% faster.)
 */
function decodeChunks(bytes: Uint8Array, pixels: Int32Array): void {
  const pixelCount = pixels.length;
  // Each entry holds a packed pixel; all start as zero (transparent black).
  const index = new Int32Array(64);
  // Chunks end where the end marker starts. Every op is at most 5 bytes and
  // starts before chunkEnd, so reads within the loop never pass the end of
  // the data; whether the last op ran into the marker is checked after.
  const chunkEnd = bytes.length - END_MARKER_SIZE;
  let p = HEADER_SIZE;
  let o = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;
  let px = a << 24;

  while (o < pixelCount) {
    if (p >= chunkEnd) {
      throw new Error(
        `Invalid QOI image: data is truncated after ${o} of ${pixelCount} pixels`,
      );
    }
    const b1 = bytes[p++];
    if (b1 < 0x40) {
      // QOI_OP_INDEX: a previously seen pixel. Storing it back below is a
      // no-op for a valid stream, whose entries sit at their own hash, but
      // keeps the index in step with the reference decoder otherwise.
      px = index[b1];
      r = px & 0xff;
      g = (px >> 8) & 0xff;
      b = (px >> 16) & 0xff;
      a = (px >> 24) & 0xff;
      index[(r * 3 + g * 5 + b * 7 + a * 11) & 63] = px;
      pixels[o++] = px;
      continue;
    } else if (b1 < 0x80) {
      // QOI_OP_DIFF: three 2-bit differences, biased by 2.
      r = (r + ((b1 >> 4) & 3) - 2) & 0xff;
      g = (g + ((b1 >> 2) & 3) - 2) & 0xff;
      b = (b + (b1 & 3) - 2) & 0xff;
    } else if (b1 < 0xc0) {
      // QOI_OP_LUMA: a 6-bit green difference (bias 32), then 4-bit red and
      // blue differences relative to it (bias 8).
      const b2 = bytes[p++];
      const vg = (b1 & 0x3f) - 32;
      r = (r + vg - 8 + (b2 >> 4)) & 0xff;
      g = (g + vg) & 0xff;
      b = (b + vg - 8 + (b2 & 0x0f)) & 0xff;
    } else if (b1 < 0xfe) {
      // QOI_OP_RUN: repeat the previous pixel 1..62 times (bias 1). A run
      // past the last pixel is cut short, as in the reference decoder, which
      // also stores the pixel in the index (that matters only for a run of
      // the initial pixel, which isn't in the index yet).
      index[(r * 3 + g * 5 + b * 7 + a * 11) & 63] = px;
      const end = Math.min(o + (b1 & 0x3f) + 1, pixelCount);
      if (end - o > 16) {
        pixels.fill(px, o, end);
        o = end;
      } else {
        while (o < end) pixels[o++] = px;
      }
      continue;
    } else if (b1 === 0xfe) {
      // QOI_OP_RGB
      r = bytes[p];
      g = bytes[p + 1];
      b = bytes[p + 2];
      p += 3;
    } else {
      // QOI_OP_RGBA
      r = bytes[p];
      g = bytes[p + 1];
      b = bytes[p + 2];
      a = bytes[p + 3];
      p += 4;
    }
    px = r | (g << 8) | (b << 16) | (a << 24);
    index[(r * 3 + g * 5 + b * 7 + a * 11) & 63] = px;
    pixels[o++] = px;
  }

  if (
    p > chunkEnd ||
    bytes[p] !== 0 ||
    bytes[p + 1] !== 0 ||
    bytes[p + 2] !== 0 ||
    bytes[p + 3] !== 0 ||
    bytes[p + 4] !== 0 ||
    bytes[p + 5] !== 0 ||
    bytes[p + 6] !== 0 ||
    bytes[p + 7] !== 1
  ) {
    throw new Error("Invalid QOI image: missing end marker");
  }

  if (!LITTLE_ENDIAN) {
    // The packed words were stored as A, B, G, R; swap them into R, G, B, A.
    for (let i = 0; i < pixelCount; i++) {
      const v = pixels[i];
      pixels[i] =
        ((v & 0xff) << 24) |
        ((v & 0xff00) << 8) |
        ((v >> 8) & 0xff00) |
        ((v >> 24) & 0xff);
    }
  }
}
