/**
 * Parse typographic metrics from the hhea and head tables of a font binary.
 *
 * These values are needed to compute CSS `line-height: normal` to match
 * Chrome (macOS) and Satori: (ascender - descender) / unitsPerEm * fontSize
 */

export type FontMetrics = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
};

/**
 * Parse the hhea and head tables from a TrueType/OpenType font binary
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

  const numTables = view.getUint16(4);
  if (buf.byteLength < 12 + numTables * 16) return null;

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

  // head table: unitsPerEm is at offset 18 (uint16)
  if (buf.byteLength < headOffset + 20) return null;
  const unitsPerEm = view.getUint16(headOffset + 18);

  // hhea table: ascender (offset 4, int16), descender (offset 6, int16)
  if (buf.byteLength < hheaOffset + 8) return null;
  const ascender = view.getInt16(hheaOffset + 4);
  const descender = view.getInt16(hheaOffset + 6);

  return { unitsPerEm, ascender, descender };
}
