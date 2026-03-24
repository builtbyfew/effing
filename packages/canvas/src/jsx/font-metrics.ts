/**
 * Parse typographic metrics from the hhea and head tables of a font binary.
 *
 * We parse the font binary ourselves because the canvas API (skia) only
 * exposes ascent and descent — not the line gap. Some fonts split their
 * vertical spacing across three values: ascender, descender, and a separate
 * line gap (sTypoLineGap in the OS/2 table). When the canvas reports just
 * ascent + descent for these fonts, the line gap is lost, producing a
 * line-height that's too tight (e.g. 1.0× font size instead of ~1.3×).
 *
 * We read hhea metrics specifically because that's what Satori uses (via
 * opentype.js). For fonts with a separate line gap, the hhea ascender is
 * typically inflated to include it, so (ascender - descender) / unitsPerEm
 * gives the intended line-height in a single subtraction.
 *
 * Supports TrueType/OpenType (.ttf/.otf) and WOFF (.woff) formats.
 */

import { inflateSync } from "node:zlib";

export type FontMetrics = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
};

/**
 * Convert hhea font metrics to pixel values at a given font size.
 */
export function fontMetricsToPx(
  metrics: FontMetrics,
  fontSize: number,
): { ascent: number; descent: number } {
  return {
    ascent: (metrics.ascender / metrics.unitsPerEm) * fontSize,
    descent: (-metrics.descender / metrics.unitsPerEm) * fontSize,
  };
}

// WOFF signature: 'wOFF' (0x774F4646)
const WOFF_SIGNATURE = 0x774f4646;

type WoffTableEntry = {
  offset: number;
  compLength: number;
  origLength: number;
};

/**
 * Read the raw bytes for a table from a WOFF file,
 * decompressing with zlib if the table is compressed.
 */
function readWoffTable(view: DataView, entry: WoffTableEntry): DataView | null {
  const compressed = entry.compLength < entry.origLength;
  if (compressed) {
    try {
      const compData = new Uint8Array(
        view.buffer,
        view.byteOffset + entry.offset,
        entry.compLength,
      );
      const decompressed = inflateSync(compData);
      return new DataView(
        decompressed.buffer,
        decompressed.byteOffset,
        decompressed.byteLength,
      );
    } catch {
      return null;
    }
  }
  return new DataView(
    view.buffer,
    view.byteOffset + entry.offset,
    entry.origLength,
  );
}

function parseWoff(view: DataView): FontMetrics | null {
  if (view.byteLength < 44) return null;
  const numTables = view.getUint16(12);
  if (view.byteLength < 44 + numTables * 20) return null;

  let headEntry: WoffTableEntry | null = null;
  let hheaEntry: WoffTableEntry | null = null;

  for (let i = 0; i < numTables; i++) {
    const r = 44 + i * 20;
    const tag =
      String.fromCharCode(view.getUint8(r)) +
      String.fromCharCode(view.getUint8(r + 1)) +
      String.fromCharCode(view.getUint8(r + 2)) +
      String.fromCharCode(view.getUint8(r + 3));
    const offset = view.getUint32(r + 4);
    const compLength = view.getUint32(r + 8);
    const origLength = view.getUint32(r + 12);

    if (tag === "head") headEntry = { offset, compLength, origLength };
    else if (tag === "hhea") hheaEntry = { offset, compLength, origLength };
  }

  if (!headEntry || !hheaEntry) return null;

  const headView = readWoffTable(view, headEntry);
  const hheaView = readWoffTable(view, hheaEntry);
  if (!headView || !hheaView) return null;

  if (headView.byteLength < 20 || hheaView.byteLength < 8) return null;

  const unitsPerEm = headView.getUint16(18);
  const ascender = hheaView.getInt16(4);
  const descender = hheaView.getInt16(6);

  return { unitsPerEm, ascender, descender };
}

function parseSfnt(view: DataView): FontMetrics | null {
  const numTables = view.getUint16(4);
  if (view.byteLength < 12 + numTables * 16) return null;

  let headOffset = -1;
  let hheaOffset = -1;

  for (let i = 0; i < numTables; i++) {
    const recordOffset = 12 + i * 16;
    const tag =
      String.fromCharCode(view.getUint8(recordOffset)) +
      String.fromCharCode(view.getUint8(recordOffset + 1)) +
      String.fromCharCode(view.getUint8(recordOffset + 2)) +
      String.fromCharCode(view.getUint8(recordOffset + 3));

    const offset = view.getUint32(recordOffset + 8);

    if (tag === "head") headOffset = offset;
    else if (tag === "hhea") hheaOffset = offset;
  }

  if (headOffset < 0 || hheaOffset < 0) return null;

  if (view.byteLength < headOffset + 20) return null;
  const unitsPerEm = view.getUint16(headOffset + 18);

  if (view.byteLength < hheaOffset + 8) return null;
  const ascender = view.getInt16(hheaOffset + 4);
  const descender = view.getInt16(hheaOffset + 6);

  return { unitsPerEm, ascender, descender };
}

/**
 * Parse the hhea and head tables from a TrueType/OpenType or WOFF font binary
 * to extract line spacing metrics.
 *
 * Returns `null` if the font lacks a required table (e.g. some bitmap fonts).
 */
export function parseFontMetrics(
  data: Buffer | ArrayBuffer,
): FontMetrics | null {
  const buf =
    data instanceof ArrayBuffer
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const view = new DataView(buf);

  if (buf.byteLength < 12) return null;

  const signature = view.getUint32(0);
  if (signature === WOFF_SIGNATURE) {
    return parseWoff(view);
  }
  return parseSfnt(view);
}
