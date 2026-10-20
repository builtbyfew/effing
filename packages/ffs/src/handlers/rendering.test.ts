import { describe, expect, test } from "vitest";
import { coverContentType } from "./rendering";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const QOI = new Uint8Array([0x71, 0x6f, 0x69, 0x66, 0, 0, 0, 1, 0, 0, 0, 1]);
const WEBP = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");

describe("coverContentType", () => {
  test.each([
    ["PNG", PNG, "image/png"],
    ["JPEG", JPEG, "image/jpeg"],
    ["QOI", QOI, "image/qoi"],
  ])(
    "sniffs a %s cover, whatever its source declares",
    (_, bytes, expected) => {
      expect(coverContentType(bytes, null)).toBe(expected);
      expect(coverContentType(bytes, "image/png")).toBe(expected);
      expect(coverContentType(bytes, "application/octet-stream")).toBe(
        expected,
      );
    },
  );

  test("falls back to the declared image type for other formats", () => {
    expect(coverContentType(WEBP, "image/webp")).toBe("image/webp");
    // A data URL's media type, or a Content-Type with parameters
    expect(coverContentType(WEBP, "image/webp;base64")).toBe("image/webp");
    expect(coverContentType(WEBP, "Image/WebP; charset=binary")).toBe(
      "image/webp",
    );
  });

  test("uses application/octet-stream when nothing names an image type", () => {
    expect(coverContentType(WEBP, null)).toBe("application/octet-stream");
    expect(coverContentType(WEBP, "")).toBe("application/octet-stream");
    expect(coverContentType(WEBP, ";base64")).toBe("application/octet-stream");
    expect(coverContentType(WEBP, "text/html")).toBe(
      "application/octet-stream",
    );
    expect(coverContentType(WEBP, "image/")).toBe("application/octet-stream");
  });
});
