import { describe, expect, test } from "vitest";

import { sniffImageContentType } from "./sniff";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
// "qoif", then width 1 and height 1
const QOI_START = [0x71, 0x6f, 0x69, 0x66, 0, 0, 0, 1, 0, 0, 0, 1];

describe("sniffImageContentType", () => {
  test.each([
    ["PNG", PNG, "image/png"],
    ["PNG with an IHDR chunk", [...PNG, 0, 0, 0, 13, 0x49, 0x48], "image/png"],
    ["JPEG (JFIF)", JPEG, "image/jpeg"],
    ["JPEG (Exif)", [0xff, 0xd8, 0xff, 0xe1], "image/jpeg"],
    ["JPEG, only its first 3 bytes", [0xff, 0xd8, 0xff], "image/jpeg"],
    ["QOI, RGB, sRGB", [...QOI_START, 3, 0], "image/qoi"],
    ["QOI, RGBA, linear", [...QOI_START, 4, 1], "image/qoi"],
    ["QOI, its magic only", QOI_START.slice(0, 4), "image/qoi"],
    ["QOI, header cut short", [...QOI_START, 4], "image/qoi"],
  ])("recognises %s", (_, bytes, expected) => {
    expect(sniffImageContentType(new Uint8Array(bytes))).toBe(expected);
  });

  test.each([
    ["empty input", []],
    ["PNG, only its first 2 bytes", PNG.slice(0, 2)],
    ["PNG, only its first 7 bytes", PNG.slice(0, 7)],
    ["PNG with a corrupted signature", [...PNG.slice(0, 7), 0x0d]],
    ["JPEG, only its first 2 bytes", [0xff, 0xd8]],
    ["JPEG without a marker after SOI", [0xff, 0xd8, 0x00, 0xe0]],
    ["a partial QOI magic", [0x71, 0x6f, 0x69]],
    ["a different 'qoi' prefix", [0x71, 0x6f, 0x69, 0x21]],
    ["QOI with 2 channels", [...QOI_START, 2, 0]],
    ["QOI with 5 channels", [...QOI_START, 5, 0]],
    ["QOI with colorspace 2", [...QOI_START, 4, 2]],
    ["WebP", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ["GIF", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  ])("returns undefined for %s", (_, bytes) => {
    expect(sniffImageContentType(new Uint8Array(bytes))).toBeUndefined();
  });

  test("reads a view at its own offset", () => {
    const backing = new Uint8Array([0x89, 0x50, ...QOI_START, 4, 0]);
    expect(sniffImageContentType(backing.subarray(2))).toBe("image/qoi");
    const png = new Uint8Array([0x71, 0x6f, ...PNG]);
    expect(sniffImageContentType(png.subarray(2))).toBe("image/png");
  });
});
