/**
 * What an image's header says about the frames FFmpeg decodes from it.
 */
export type ImageInfo = {
  format: "png" | "jpeg" | "qoi";
  width: number;
  height: number;
  /**
   * Whether FFmpeg decodes the image to a pixel format with an alpha
   * channel. An image without one is opaque.
   */
  alpha: boolean;
  /**
   * Whether FFmpeg rotates or flips the decoded image, as a JPEG's EXIF
   * orientation says. `width` and `height` are the size once it has.
   */
  oriented: boolean;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const QOI_MAGIC = [0x71, 0x6f, 0x69, 0x66]; // "qoif"

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, i) => bytes[i] === byte)
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16(
  bytes: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number {
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : readUint16BE(bytes, offset);
}

function readUint32(
  bytes: Uint8Array,
  offset: number,
  littleEndian: boolean,
): number {
  return littleEndian
    ? (bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)) >>>
        0
    : readUint32BE(bytes, offset);
}

/**
 * PNG: the size is in IHDR. FFmpeg's PNG decoder outputs an alpha format for
 * the colour types with alpha (4 and 6), for palette images (pal8 carries
 * the palette's alpha) and for greyscale or RGB images with a tRNS chunk,
 * and rotates or flips the image as an eXIf chunk's orientation says. Both
 * chunks have to come before the first IDAT.
 */
function readPngInfo(bytes: Uint8Array): ImageInfo | undefined {
  // Signature, then IHDR: length, "IHDR", width, height, depth, colour type
  if (bytes.length < 26) return undefined;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") {
    return undefined;
  }
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  const colorType = bytes[25];
  let alpha = colorType !== 0 && colorType !== 2;
  let orientation: number | undefined;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "tRNS") alpha = true;
    // The first eXIf chunk is the one FFmpeg reads.
    if (type === "eXIf" && orientation === undefined) {
      const end = Math.min(offset + 8 + length, bytes.length);
      orientation = readTiffOrientation(bytes, offset + 8, end);
    }
    if (type === "IDAT" || type === "IEND") {
      return orientedInfo("png", width, height, alpha, orientation ?? 1);
    }
    offset += 12 + length; // length, type, data, CRC
  }
  // The chunks before the image data didn't fit in `bytes`.
  return undefined;
}

/**
 * The info of an image FFmpeg rotates or flips as its EXIF `orientation`
 * (1-8) says, which swaps width and height for orientations 5-8.
 */
function orientedInfo(
  format: ImageInfo["format"],
  width: number,
  height: number,
  alpha: boolean,
  orientation: number,
): ImageInfo {
  const swapped = orientation >= 5;
  return {
    format,
    width: swapped ? height : width,
    height: swapped ? width : height,
    alpha,
    oriented: orientation !== 1,
  };
}

/**
 * The orientation (1-8) in TIFF-structured EXIF data at `bytes[start, end)`
 * (a PNG eXIf chunk's data): 1 (as is) when it has none.
 */
function readTiffOrientation(
  bytes: Uint8Array,
  start: number,
  end: number,
): number {
  // Byte order, 42, offset of IFD0
  if (start + 8 > end) return 1;
  const byteOrder = String.fromCharCode(bytes[start], bytes[start + 1]);
  if (byteOrder !== "II" && byteOrder !== "MM") return 1;
  const littleEndian = byteOrder === "II";
  const ifd = start + readUint32(bytes, start + 4, littleEndian);
  if (ifd + 2 > end) return 1;
  const entries = readUint16(bytes, ifd, littleEndian);
  for (let i = 0; i < entries; i++) {
    // Tag, type, count, value
    const entry = ifd + 2 + 12 * i;
    if (entry + 12 > end) return 1;
    if (readUint16(bytes, entry, littleEndian) === 0x0112) {
      const orientation = readUint16(bytes, entry + 8, littleEndian);
      return orientation >= 1 && orientation <= 8 ? orientation : 1;
    }
  }
  return 1;
}

/**
 * The orientation (1-8) in a JPEG APP1 segment whose data is
 * `bytes[start, end)`: 1 (as is) when the Exif data has none. Undefined when
 * the segment isn't Exif.
 */
function readExifOrientation(
  bytes: Uint8Array,
  start: number,
  end: number,
): number | undefined {
  // "Exif\0\0", then the TIFF data
  const header = String.fromCharCode(...bytes.subarray(start, start + 6));
  if (end - start < 6 || header !== "Exif\0\0") return undefined;
  return readTiffOrientation(bytes, start + 6, end);
}

/**
 * JPEG: the size and component count are in the first start-of-frame
 * segment. FFmpeg's JPEG decoder outputs a format with an alpha plane for
 * 4-component (CMYK or YCCK) JPEGs, and rotates or flips the image as the
 * EXIF orientation says, which swaps width and height for orientations 5-8.
 */
function readJpegInfo(bytes: Uint8Array): ImageInfo | undefined {
  let orientation: number | undefined;
  let offset = 2; // after SOI
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset++; // fill byte
      continue;
    }
    // Markers without a length: TEM, RSTn, SOI, EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = readUint16BE(bytes, offset + 2);
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      // Length, precision, height, width, component count
      if (offset + 10 > bytes.length) return undefined;
      const height = readUint16BE(bytes, offset + 5);
      const width = readUint16BE(bytes, offset + 7);
      const components = bytes[offset + 9];
      return orientedInfo(
        "jpeg",
        width,
        height,
        components === 4,
        orientation ?? 1,
      );
    }
    if (marker === 0xda) return undefined; // image data before any SOF
    // The first Exif segment is the one FFmpeg reads.
    if (marker === 0xe1 && orientation === undefined) {
      const end = Math.min(offset + 2 + length, bytes.length);
      orientation = readExifOrientation(bytes, offset + 4, end);
    }
    offset += 2 + length;
  }
  return undefined;
}

/**
 * QOI: the header has the size and the channel count. FFmpeg decodes
 * 3-channel QOI to rgb24 and 4-channel QOI to rgba.
 */
function readQoiInfo(bytes: Uint8Array): ImageInfo | undefined {
  if (bytes.length < 14) return undefined;
  const channels = bytes[12];
  if (channels !== 3 && channels !== 4) return undefined;
  return {
    format: "qoi",
    width: readUint32BE(bytes, 4),
    height: readUint32BE(bytes, 8),
    alpha: channels === 4,
    oriented: false,
  };
}

/**
 * Reads the size of a PNG, JPEG or QOI image, and whether FFmpeg decodes it
 * with an alpha channel, from its first bytes (see IMAGE_INFO_BYTES).
 *
 * @returns The image's info, or `undefined` when it isn't one of these
 *   formats, or its header isn't within `bytes`
 */
export function readImageInfo(bytes: Uint8Array): ImageInfo | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) return readPngInfo(bytes);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return readJpegInfo(bytes);
  }
  if (startsWith(bytes, QOI_MAGIC)) return readQoiInfo(bytes);
  return undefined;
}

/**
 * How many leading bytes of an image readImageInfo needs at most, in
 * practice: the header, plus room for the metadata (EXIF, ICC profiles)
 * that can come before a JPEG's start-of-frame or a PNG's image data.
 */
export const IMAGE_INFO_BYTES = 256 * 1024;
