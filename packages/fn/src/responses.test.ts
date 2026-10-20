import { describe, test, expect } from "vitest";
import { imageResponse, effieResponse } from "./responses";
import type { EffieData, EffieSources } from "@effing/effie";

describe("imageResponse", () => {
  test("detects PNG from magic bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = imageResponse(png);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  test("throws on a truncated PNG signature", () => {
    const truncated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(() => imageResponse(truncated)).toThrow("Unsupported image format");
  });

  test("detects JPEG from magic bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = imageResponse(jpeg);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test("detects QOI from magic bytes", () => {
    // "qoif", a 1x1 RGBA header, one QOI_OP_RGBA pixel and the end marker
    const qoi = Buffer.from([
      0x71, 0x6f, 0x69, 0x66, 0, 0, 0, 1, 0, 0, 0, 1, 4, 0, 0xff, 1, 2, 3, 4, 0,
      0, 0, 0, 0, 0, 0, 1,
    ]);
    const res = imageResponse(qoi);
    expect(res.headers.get("Content-Type")).toBe("image/qoi");
  });

  test("throws on unknown format", () => {
    const unknown = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(() => imageResponse(unknown)).toThrow(
      "Unsupported image format: expected PNG, JPEG or QOI",
    );
  });

  test("throws on WebP", () => {
    const webp = Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1");
    expect(() => imageResponse(webp)).toThrow("Unsupported image format");
  });

  test("sets default Cache-Control", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = imageResponse(jpeg);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  test("respects cacheControl option", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = imageResponse(jpeg, { cacheControl: "no-store" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("serves only the view window for an offset-backed buffer", async () => {
    const backing = new Uint8Array(64).fill(0xaa); // garbage
    // The PNG signature at offset 8, an 8-byte "image"
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    backing.set(png, 8);
    const view = backing.subarray(8, 16); // byteOffset 8, length 8
    const res = imageResponse(view);
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBe(8);
    expect(Array.from(body)).toEqual(png);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });
});

describe("effieResponse", () => {
  test("returns JSON with correct Content-Type", () => {
    const data = {
      width: 1080,
      height: 1920,
      fps: 30,
      cover: "https://example.com/cover.png",
      segments: [],
    } as unknown as EffieData<EffieSources>;

    const res = effieResponse(data);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  test("serializes effie data as JSON body", async () => {
    const data = {
      width: 1080,
      height: 1920,
      fps: 30,
      cover: "https://example.com/cover.png",
      segments: [],
    } as unknown as EffieData<EffieSources>;

    const res = effieResponse(data);
    const body = await res.json();
    expect(body.width).toBe(1080);
    expect(body.fps).toBe(30);
  });
});
