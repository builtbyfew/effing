// The line gap of each registered font, read from its hhea table. Skia's
// paragraph reports a font's hhea ascent and descent but not its line gap,
// which `line-height: normal` adds to them (see `normalLineBox`).

import { brotliDecompressSync, inflateSync } from "node:zlib";

/** A face's hhea metrics in em, its descent positive. */
type FaceMetrics = { ascent: number; descent: number; lineGap: number };

/** Faces by lower-cased family name; "" for a font registered without one. */
const facesByFamily = new Map<string, FaceMetrics[]>();
let generation = 0;

/**
 * Reset the registered metrics (test-only).
 */
export function _resetFontMetricsForTest(): void {
  facesByFamily.clear();
  generation++;
}

/**
 * Bumped whenever a font is registered, which can change the font a family
 * list resolves to: a cache of anything derived from fonts keys on it.
 */
export function fontGeneration(): number {
  return generation;
}

/**
 * Remember the hhea metrics of every face in a font file (TrueType, OpenType,
 * a collection of either, WOFF or WOFF2), registered under `family`, or ""
 * for the family names in the file. A file that can't be read is skipped:
 * its line gap counts as none.
 */
export function registerFontMetrics(family: string, data: Uint8Array): void {
  generation++;
  let faces: FaceMetrics[];
  try {
    faces = readFaceMetrics(data);
  } catch {
    return;
  }
  const key = family.toLowerCase();
  facesByFamily.set(key, [...(facesByFamily.get(key) ?? []), ...faces]);
}

function unquote(family: string): string {
  const f = family.trim();
  return /^(["']).*\1$/.test(f) ? f.slice(1, -1) : f;
}

/**
 * The hhea line gap in px of the font that a paragraph in `fontFamily` laid
 * out with `ascent` and `descent` (px, at `fontSize`): the registered face
 * with those metrics, preferring the families in the list, in order. 0 for a
 * font that wasn't registered with its data (such as a system font).
 */
export function fontLineGap(
  fontFamily: string,
  fontSize: number,
  ascent: number,
  descent: number,
): number {
  const listed = fontFamily
    .split(",")
    .flatMap((f) => facesByFamily.get(unquote(f).toLowerCase()) ?? []);
  const all = [...facesByFamily.values()].flat();
  // Skia scales the metrics in single precision.
  const tolerance = 1e-5 * fontSize;
  const face = [...listed, ...all].find(
    (f) =>
      Math.abs(f.ascent * fontSize - ascent) <= tolerance &&
      Math.abs(f.descent * fontSize - descent) <= tolerance,
  );
  return face ? face.lineGap * fontSize : 0;
}

const tag = (data: Uint8Array, at: number) =>
  String.fromCharCode(data[at]!, data[at + 1]!, data[at + 2]!, data[at + 3]!);

/** A font file's tables by tag, for one face. */
type Tables = Map<string, Uint8Array>;

function readFaceMetrics(data: Uint8Array): FaceMetrics[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const signature = tag(data, 0);
  let faces: Tables[];
  if (signature === "wOFF") faces = [readWoff(data, view)];
  else if (signature === "wOF2") faces = readWoff2(data, view);
  else if (signature === "ttcf") {
    faces = [];
    const count = view.getUint32(8);
    for (let i = 0; i < count; i++) {
      faces.push(readSfnt(data, view, view.getUint32(12 + 4 * i)));
    }
  } else faces = [readSfnt(data, view, 0)];

  return faces.flatMap((tables) => {
    const head = tables.get("head");
    const hhea = tables.get("hhea");
    if (!head || head.length < 20 || !hhea || hhea.length < 10) return [];
    const unitsPerEm = new DataView(head.buffer, head.byteOffset).getUint16(18);
    if (unitsPerEm === 0) return [];
    const h = new DataView(hhea.buffer, hhea.byteOffset);
    return [
      {
        ascent: h.getInt16(4) / unitsPerEm,
        descent: -h.getInt16(6) / unitsPerEm,
        lineGap: h.getInt16(8) / unitsPerEm,
      },
    ];
  });
}

function readSfnt(data: Uint8Array, view: DataView, offset: number): Tables {
  const tables: Tables = new Map();
  const count = view.getUint16(offset + 4);
  for (let i = 0; i < count; i++) {
    const record = offset + 12 + 16 * i;
    const start = view.getUint32(record + 8);
    tables.set(
      tag(data, record),
      data.subarray(start, start + view.getUint32(record + 12)),
    );
  }
  return tables;
}

function readWoff(data: Uint8Array, view: DataView): Tables {
  const tables: Tables = new Map();
  const count = view.getUint16(12);
  for (let i = 0; i < count; i++) {
    const entry = 44 + 20 * i;
    const name = tag(data, entry);
    if (name !== "head" && name !== "hhea") continue;
    const start = view.getUint32(entry + 4);
    const compressed = data.subarray(start, start + view.getUint32(entry + 8));
    tables.set(
      name,
      compressed.length < view.getUint32(entry + 12)
        ? inflateSync(compressed)
        : compressed,
    );
  }
  return tables;
}

// WOFF2's table directory names the common tables by their index here.
const WOFF2_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ",
  "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp",
  "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF",
  "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL",
  "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc",
  "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx",
  "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
]; // prettier-ignore

/**
 * The head and hhea tables of a WOFF2 font, which it never transforms. A
 * WOFF2 collection is skipped.
 */
function readWoff2(data: Uint8Array, view: DataView): Tables[] {
  if (tag(data, 4) === "ttcf") return [];
  const count = view.getUint16(12);
  let at = 48;
  const readBase128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = data[at++]!;
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error("Invalid UIntBase128");
  };
  // Where each table is in the decompressed stream, which holds them in
  // directory order.
  const entries: { name: string; start: number; length: number }[] = [];
  let streamOffset = 0;
  for (let i = 0; i < count; i++) {
    const flags = data[at++]!;
    let name: string;
    if ((flags & 0x3f) === 0x3f) {
      name = tag(data, at);
      at += 4;
    } else {
      name = WOFF2_TAGS[flags & 0x3f]!;
    }
    const version = flags >> 6;
    let length = readBase128();
    // glyf and loca are transformed unless version 3; others unless 0.
    const transformed =
      name === "glyf" || name === "loca" ? version !== 3 : version !== 0;
    if (transformed) length = readBase128();
    entries.push({ name, start: streamOffset, length });
    streamOffset += length;
  }
  const stream = brotliDecompressSync(
    data.subarray(at, at + view.getUint32(20)),
  );
  const tables: Tables = new Map();
  for (const { name, start, length } of entries) {
    if (name === "head" || name === "hhea") {
      tables.set(name, stream.subarray(start, start + length));
    }
  }
  return [tables];
}
