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
    });
    expect(readImageInfo(qoi(4))).toMatchObject({ alpha: true });
    expect(readImageInfo(qoi(5))).toBeUndefined();
  });

  test("anything else is unknown", () => {
    expect(readImageInfo(new Uint8Array())).toBeUndefined();
    expect(readImageInfo(Buffer.from("GIF89a....", "latin1"))).toBeUndefined();
  });
});
