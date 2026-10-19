import { describe, expect, test } from "vitest";

import { sniffImageContentType } from "./sniff";

describe("sniffImageContentType", () => {
  test.each([
    ["PNG", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
    ["JPEG", [0xff, 0xd8, 0xff, 0xe0], "image/jpeg"],
    [
      "QOI",
      [0x71, 0x6f, 0x69, 0x66, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0],
      "image/qoi",
    ],
  ])("recognises %s", (_, bytes, expected) => {
    expect(sniffImageContentType(new Uint8Array(bytes))).toBe(expected);
  });

  test.each([
    ["empty input", []],
    ["a partial QOI magic", [0x71, 0x6f, 0x69]],
    ["a different 'qoi' prefix", [0x71, 0x6f, 0x69, 0x21]],
    ["WebP", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ["GIF", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  ])("returns undefined for %s", (_, bytes) => {
    expect(sniffImageContentType(new Uint8Array(bytes))).toBeUndefined();
  });

  test("reads a view at its own offset", () => {
    const backing = new Uint8Array([0x89, 0x50, 0x71, 0x6f, 0x69, 0x66]);
    expect(sniffImageContentType(backing.subarray(2))).toBe("image/qoi");
  });
});
