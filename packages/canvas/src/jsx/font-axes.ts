import { brotliDecompressSync, inflateSync } from "node:zlib";

/**
 * The range of a variable font's `wght` axis, read from its `fvar` table, or
 * `null` for a static font. Reads TrueType and OpenType files, WOFF and
 * WOFF2; returns `null` for font collections, for a compressed font that
 * declares more than {@link MAX_DECOMPRESSED} bytes, and for anything it
 * can't read.
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

/** The most this reads decompresses, whatever a font declares. */
const MAX_DECOMPRESSED = 64 * 1024 * 1024;

const SFNT_VERSIONS = new Set([
  0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */,
]);
const WOFF = 0x774f4646; // wOFF
const WOFF2 = 0x774f4632; // wOF2
const TTCF = 0x74746366; // ttcf
const FVAR = 0x66766172; // fvar
const WGHT = 0x77676874; // wght

/** WOFF2's known table tags, by the index a table directory entry gives. */
const WOFF2_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ",
  "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp",
  "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF",
  "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL",
  "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc",
  "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx",
  "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
]; // prettier-ignore

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function tag(dv: DataView, offset: number): string {
  return String.fromCharCode(
    dv.getUint8(offset),
    dv.getUint8(offset + 1),
    dv.getUint8(offset + 2),
    dv.getUint8(offset + 3),
  );
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
      if (compLength >= origLength) return table;
      if (origLength > MAX_DECOMPRESSED) return null;
      return inflateSync(table, { maxOutputLength: origLength });
    }
    return null;
  }
  if (signature === WOFF2) return woff2FvarTable(data, dv);
  return null;
}

/** A WOFF2 font's `fvar` table (not a font collection's). */
function woff2FvarTable(data: Uint8Array, dv: DataView): Uint8Array | null {
  if (dv.getUint32(4) === TTCF) return null;
  const numTables = dv.getUint16(12);
  const totalSfntSize = dv.getUint32(16);
  const totalCompressedSize = dv.getUint32(20);
  let pos = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = dv.getUint8(pos++);
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error("Bad UIntBase128");
  };
  // Tables follow each other in the decompressed stream, in directory order,
  // each at its transformed length if transformed.
  let start = 0;
  let fvar: [number, number] | null = null;
  for (let i = 0; i < numTables; i++) {
    const flags = dv.getUint8(pos++);
    let name: string;
    if ((flags & 0x3f) === 0x3f) {
      name = tag(dv, pos);
      pos += 4;
    } else {
      name = WOFF2_TAGS[flags & 0x3f]!;
    }
    const version = flags >> 6;
    let length = base128();
    // glyf and loca are transformed at version 0, other tables at any other.
    const transformed =
      name === "glyf" || name === "loca" ? version === 0 : version !== 0;
    if (transformed) length = base128();
    if (name === "fvar") fvar = [start, length];
    start += length;
  }
  if (!fvar) return null;
  const size = Math.max(totalSfntSize, start);
  if (size > MAX_DECOMPRESSED) return null;
  const stream = brotliDecompressSync(
    data.subarray(pos, pos + totalCompressedSize),
    { maxOutputLength: size },
  );
  return stream.subarray(fvar[0], fvar[0] + fvar[1]);
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
