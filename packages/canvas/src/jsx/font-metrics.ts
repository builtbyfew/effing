/**
 * Parse typographic metrics from the OS/2 and head tables of a font binary.
 *
 * These values are needed to compute CSS `line-height: normal` per spec:
 * (sTypoAscender - sTypoDescender + sTypoLineGap) / unitsPerEm * fontSize
 */

export type FontMetrics = {
  unitsPerEm: number;
  sTypoAscender: number;
  sTypoDescender: number;
  sTypoLineGap: number;
};

/**
 * Parse the OS/2 and head tables from a TrueType/OpenType font binary
 * to extract typographic line spacing metrics.
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
  let os2Offset = -1;

  for (let i = 0; i < numTables; i++) {
    const recordOffset = 12 + i * 16;
    const tag =
      String.fromCharCode(view.getUint8(recordOffset)) +
      String.fromCharCode(view.getUint8(recordOffset + 1)) +
      String.fromCharCode(view.getUint8(recordOffset + 2)) +
      String.fromCharCode(view.getUint8(recordOffset + 3));

    const offset = view.getUint32(recordOffset + 8);

    if (tag === "head") headOffset = offset;
    else if (tag === "OS/2") os2Offset = offset;
  }

  if (headOffset < 0 || os2Offset < 0) return null;

  // head table: unitsPerEm is at offset 18 (uint16)
  if (buf.byteLength < headOffset + 20) return null;
  const unitsPerEm = view.getUint16(headOffset + 18);

  // OS/2 table: sTypoAscender (offset 68, int16), sTypoDescender (offset 70, int16),
  // sTypoLineGap (offset 72, int16)
  if (buf.byteLength < os2Offset + 74) return null;
  const sTypoAscender = view.getInt16(os2Offset + 68);
  const sTypoDescender = view.getInt16(os2Offset + 70);
  const sTypoLineGap = view.getInt16(os2Offset + 72);

  return { unitsPerEm, sTypoAscender, sTypoDescender, sTypoLineGap };
}
