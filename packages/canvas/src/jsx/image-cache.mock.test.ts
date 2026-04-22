import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../canvas-mock.ts");
  return createCanvasMock();
});

import { loadImage } from "@napi-rs/canvas";
import { cachedLoadImage, type ImageCache } from "./image-cache.ts";

describe("cachedLoadImage", () => {
  let cache: ImageCache;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cache = new Map();
    vi.mocked(loadImage).mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches remote https URLs via global fetch and passes bytes to loadImage", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => bytes.buffer,
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(cache, "https://example.com/pic.png");

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/pic.png");
    expect(loadImage).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(loadImage).mock.calls[0]![0];
    expect(Buffer.isBuffer(arg)).toBe(true);
    expect(arg).not.toBe("https://example.com/pic.png");
    expect((arg as Buffer).equals(Buffer.from(bytes))).toBe(true);
  });

  it("fetches remote http URLs via global fetch", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(cache, "http://example.com/pic.png");

    expect(fetchMock).toHaveBeenCalledWith("http://example.com/pic.png");
  });

  it("throws an error naming the URL and status on non-OK responses", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;

    await expect(
      cachedLoadImage(cache, "https://example.com/missing.png"),
    ).rejects.toThrow(/https:\/\/example\.com\/missing\.png.*404.*Not Found/);
    expect(loadImage).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent remote fetches for the same URL", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const url = "https://example.com/dedup.png";
    const [a, b] = await Promise.all([
      cachedLoadImage(cache, url),
      cachedLoadImage(cache, url),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loadImage).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("passes non-remote string sources directly to loadImage", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(cache, "/local/path.png");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadImage).toHaveBeenCalledWith("/local/path.png");
  });

  it("passes Buffer sources directly to loadImage without caching", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const buf = Buffer.from([9, 8, 7]);
    await cachedLoadImage(cache, buf);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadImage).toHaveBeenCalledWith(buf);
    expect(cache.size).toBe(0);
  });
});
