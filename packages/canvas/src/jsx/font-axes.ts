import { inflateSync } from "node:zlib";

/**
 * The range of a variable font's `wght` axis, read from its `fvar` table, or
 * `null` for a static font. Reads TrueType and OpenType files and WOFF;
 * returns `null` for WOFF2 and font collections, and for anything it can't
 * read.
 *
 * @param data - The font file
 */
export function weightAxisRange(data: Uint8Array): [number, number] | null {
  try {
    const fvar = fvarTable(data);
    return fvar ? wghtAxis(fvar) : null;
  } catch {
    return null;
  }
}

const SFNT_VERSIONS = new Set([
  0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */,
]);
const WOFF = 0x774f4646; // wOFF
const FVAR = 0x66766172; // fvar
const WGHT = 0x77676874; // wght

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function fvarTable(data: Uint8Array): Uint8Array | null {
  const dv = view(data);
  const signature = dv.getUint32(0);
  if (SFNT_VERSIONS.has(signature)) {
    const numTables = dv.getUint16(4);
    for (let i = 0; i < numTables; i++) {
      const record = 12 + 16 * i;
      if (dv.getUint32(record) !== FVAR) continue;
      const offset = dv.getUint32(record + 8);
      const length = dv.getUint32(record + 12);
      return data.subarray(offset, offset + length);
    }
    return null;
  }
  if (signature === WOFF) {
    const numTables = dv.getUint16(12);
    for (let i = 0; i < numTables; i++) {
      const entry = 44 + 20 * i;
      if (dv.getUint32(entry) !== FVAR) continue;
      const offset = dv.getUint32(entry + 4);
      const compLength = dv.getUint32(entry + 8);
      const origLength = dv.getUint32(entry + 12);
      const table = data.subarray(offset, offset + compLength);
      return compLength < origLength ? inflateSync(table) : table;
    }
  }
  return null;
}

function wghtAxis(fvar: Uint8Array): [number, number] | null {
  const dv = view(fvar);
  const axesArrayOffset = dv.getUint16(4);
  const axisCount = dv.getUint16(8);
  const axisSize = dv.getUint16(10);
  for (let i = 0; i < axisCount; i++) {
    const axis = axesArrayOffset + axisSize * i;
    if (dv.getUint32(axis) !== WGHT) continue;
    const min = dv.getInt32(axis + 4) / 65536;
    const max = dv.getInt32(axis + 12) / 65536;
    return min <= max ? [min, max] : [max, min];
  }
  return null;
}
