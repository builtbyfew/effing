import { describe, expect, test } from "vitest";
import { readImageInfo } from "./image-info";

function chunk(type: string, data: number[] = []): number[] {
  const length = [
    (data.length >>> 24) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 8) & 0xff,
    data.length & 0xff,
  ];
  // The CRC isn't checked.
  return [...length, ...Buffer.from(type, "latin1"), ...data, 0, 0, 0, 0];
}

function png(colorType: number, extraChunks: number[][] = []): Uint8Array {
  const ihdr = [0, 0, 1, 0x2c, 0, 0, 0, 0xc8, 8, colorType, 0, 0, 0]; // 300x200
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk("IHDR", ihdr),
    ...extraChunks.flat(),
    ...chunk("IDAT", [1, 2, 3]),
    ...chunk("IEND"),
  ]);
}

function segment(marker: number, data: number[]): number[] {
  const length = data.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...data];
}

function jpeg(...segments: number[][]): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, ...segments.flat(), 0xff, 0xd9]);
}

// SOF0: precision, height 1920, width 1296, 3 components
const sof0 = segment(0xc0, [8, 0x07, 0x80, 0x05, 0x10, 3, 1, 0x22, 0, 2]);

/** An APP1 Exif segment whose IFD0 has an Orientation entry. */
function exif(orientation: number, littleEndian = false): number[] {
  const u16 = (n: number) =>
    littleEndian ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff];
  const u32 = (n: number) => (littleEndian ? [n, 0, 0, 0] : [0, 0, 0, n]);
  return segment(0xe1, [
    ...Buffer.from("Exif\0\0", "latin1"),
    ...Buffer.from(littleEndian ? "II" : "MM", "latin1"),
    ...u16(42),
    ...u32(8), // IFD0 right after the header
    ...u16(2), // entries: XResolution (ignored), then Orientation
    ...u16(0x011a),
    ...u16(5),
    ...u32(1),
    ...u32(0),
    ...u16(0x0112),
    ...u16(3), // SHORT
    ...u32(1),
    ...u16(orientation),
    0,
    0,
    ...u32(0), // no next IFD
  ]);
}

function qoi(channels: number): Uint8Array {
  return Uint8Array.from([
    ...Buffer.from("qoif", "latin1"),
    0,
    0,
    4,
    0x38, // 1080
    0,
    0,
    7,
    0x80, // 1920
    channels,
    0,
  ]);
}

describe("readImageInfo", () => {
  test("a JPEG has its start-of-frame size and no alpha", () => {
    expect(readImageInfo(jpeg(sof0))).toEqual({
      format: "jpeg",
      width: 1296,
      height: 1920,
      alpha: false,
      oriented: false,
    });
  });

  test("a JPEG's size is found after APPn, DQT and DHT segments", () => {
    const app1 = segment(0xe1, new Array(1000).fill(7));
    const dqt = segment(0xdb, new Array(65).fill(1));
    const dht = segment(0xc4, new Array(30).fill(1));
    expect(readImageInfo(jpeg(app1, dqt, dht, sof0))).toMatchObject({
      width: 1296,
      height: 1920,
    });
  });

  test("a progressive JPEG's size comes from SOF2", () => {
    const sof2 = [0xff, 0xc2, ...sof0.slice(2)];
    expect(readImageInfo(jpeg(sof2))).toMatchObject({
      format: "jpeg",
      width: 1296,
    });
  });

  test("a 4-component (CMYK or YCCK) JPEG has alpha", () => {
    // FFmpeg decodes these to gbrap or yuva444p.
    const sof4 = segment(
      0xc0,
      [
        8, 0x07, 0x80, 0x05, 0x10, 4, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1, 4,
        0x11, 0,
      ],
    );
    expect(readImageInfo(jpeg(sof4))).toMatchObject({ alpha: true });
  });

  test("a JPEG's size is as FFmpeg shows it, after its EXIF orientation", () => {
    // 6: rotate 90° clockwise, which swaps width and height.
    expect(readImageInfo(jpeg(exif(6), sof0))).toEqual({
      format: "jpeg",
      width: 1920,
      height: 1296,
      alpha: false,
      oriented: true,
    });
    expect(readImageInfo(jpeg(exif(8, true), sof0))).toMatchObject({
      width: 1920,
      height: 1296,
    });
    // 3: rotate 180°, which doesn't.
    expect(readImageInfo(jpeg(exif(3, true), sof0))).toMatchObject({
      width: 1296,
      height: 1920,
      oriented: true,
    });
    expect(readImageInfo(jpeg(exif(1), sof0))).toMatchObject({
      width: 1296,
      oriented: false,
    });
  });

  test("an APP1 segment that isn't Exif, or a second Exif one, is ignored", () => {
    const xmp = segment(0xe1, [
      ...Buffer.from("http://ns.adobe.com/", "latin1"),
    ]);
    expect(readImageInfo(jpeg(xmp, exif(6), sof0))).toMatchObject({
      width: 1920,
    });
    expect(readImageInfo(jpeg(exif(1), exif(6), sof0))).toMatchObject({
      width: 1296,
      oriented: false,
    });
  });

  test("a JPEG cut off before its start-of-frame is unknown", () => {
    const app1 = segment(0xe1, new Array(1000).fill(7));
    expect(readImageInfo(jpeg(app1, sof0).subarray(0, 500))).toBeUndefined();
  });

  test("greyscale and RGB PNGs have no alpha", () => {
    expect(readImageInfo(png(2))).toEqual({
      format: "png",
      width: 300,
      height: 200,
      alpha: false,
      oriented: false,
    });
    expect(readImageInfo(png(0))).toMatchObject({ alpha: false });
  });

  test("PNGs with an alpha channel, a palette or a tRNS chunk have alpha", () => {
    expect(readImageInfo(png(6))).toMatchObject({ alpha: true });
    expect(readImageInfo(png(4))).toMatchObject({ alpha: true });
    expect(readImageInfo(png(3))).toMatchObject({ alpha: true });
    expect(readImageInfo(png(2, [chunk("tRNS", [0, 0, 0, 0, 0, 0])]))).toEqual({
      format: "png",
      width: 300,
      height: 200,
      alpha: true,
      oriented: false,
    });
  });

  test("a PNG's tRNS chunk is found after other chunks", () => {
    const text = chunk("tEXt", [...Buffer.from("Comment\0hi", "latin1")]);
    expect(
      readImageInfo(png(2, [text, chunk("tRNS", [0, 0, 0, 0, 0, 0])])),
    ).toMatchObject({ alpha: true });
  });

  test("a PNG cut off before its image data is unknown", () => {
    expect(readImageInfo(png(2).subarray(0, 40))).toBeUndefined();
  });

  test("QOI has alpha with 4 channels, not with 3", () => {
    expect(readImageInfo(qoi(3))).toEqual({
      format: "qoi",
      width: 1080,
      height: 1920,
      alpha: false,
      oriented: false,
    });
    expect(readImageInfo(qoi(4))).toMatchObject({ alpha: true });
    expect(readImageInfo(qoi(5))).toBeUndefined();
  });

  test("anything else is unknown", () => {
    expect(readImageInfo(new Uint8Array())).toBeUndefined();
    expect(readImageInfo(Buffer.from("GIF89a....", "latin1"))).toBeUndefined();
  });
});
