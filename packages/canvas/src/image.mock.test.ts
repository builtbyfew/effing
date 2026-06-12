import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("./canvas-mock.ts");
  return createCanvasMock();
});

import { loadImage } from "@napi-rs/canvas";
import {
  cachedLoadImage,
  loadImage as loadImagePublic,
  type ImageCache,
} from "./image.ts";

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

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/pic.png",
      undefined,
    );
    expect(loadImage).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(loadImage).mock.calls[0]![0];
    expect(Buffer.isBuffer(arg)).toBe(true);
    expect(arg).not.toBe("https://example.com/pic.png");
    expect((arg as Buffer).equals(Buffer.from(bytes))).toBe(true);
  });

  it("sends User-Agent header when a userAgent is passed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(
      cache,
      "https://example.com/ua.png",
      "my-renderer/1.0",
    );

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/ua.png", {
      headers: { "User-Agent": "my-renderer/1.0" },
    });
  });

  it("omits init argument when no userAgent is passed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(cache, "https://example.com/no-ua.png");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/no-ua.png",
      undefined,
    );
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

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/pic.png",
      undefined,
    );
  });

  it("sends User-Agent header on http URLs when a userAgent is passed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(
      cache,
      "http://example.com/ua.png",
      "my-renderer/1.0",
    );

    expect(fetchMock).toHaveBeenCalledWith("http://example.com/ua.png", {
      headers: { "User-Agent": "my-renderer/1.0" },
    });
  });

  it("treats an empty-string userAgent as an explicit empty header", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await cachedLoadImage(cache, "https://example.com/empty-ua.png", "");

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/empty-ua.png", {
      headers: { "User-Agent": "" },
    });
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

  it("evicts a failed load so the next call retries", async () => {
    const responses = [
      { ok: false, status: 503, statusText: "Service Unavailable" },
      { ok: true, status: 200, statusText: "OK" },
    ];
    const fetchMock = vi.fn(async () => ({
      ...responses.shift()!,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const url = "https://example.com/flaky.png";
    await expect(cachedLoadImage(cache, url)).rejects.toThrow(/503/);
    expect(cache.size).toBe(0);

    await expect(cachedLoadImage(cache, url)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(1);
  });

  it("keeps successful loads cached across sequential calls", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const url = "https://example.com/stable.png";
    const a = await cachedLoadImage(cache, url);
    const b = await cachedLoadImage(cache, url);

    expect(fetchMock).toHaveBeenCalledTimes(1);
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

describe("loadImage (public wrapper)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.mocked(loadImage).mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("routes remote https URLs through fetch and passes bytes to the native loader", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => bytes.buffer,
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadImagePublic("https://example.com/pic.png");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/pic.png",
      undefined,
    );
    const arg = vi.mocked(loadImage).mock.calls[0]![0];
    expect(Buffer.isBuffer(arg)).toBe(true);
    expect((arg as Buffer).equals(Buffer.from(bytes))).toBe(true);
  });

  it("routes remote http URLs through fetch", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadImagePublic("http://example.com/pic.png");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/pic.png",
      undefined,
    );
  });

  it("sends the userAgent option as a User-Agent header on remote fetches", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadImagePublic("https://example.com/ua.png", {
      userAgent: "my-renderer/1.0",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/ua.png", {
      headers: { "User-Agent": "my-renderer/1.0" },
    });
  });

  it("routes remote URL objects through fetch", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadImagePublic(new URL("https://example.com/obj.png"), {
      userAgent: "my-renderer/1.0",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/obj.png", {
      headers: { "User-Agent": "my-renderer/1.0" },
    });
  });

  it("delegates non-remote string sources to the native loader without fetching", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await loadImagePublic("/local/path.png");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadImage).toHaveBeenCalledWith("/local/path.png");
  });

  it("delegates Buffer sources to the native loader without fetching", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const buf = Buffer.from([9, 8, 7]);
    await loadImagePublic(buf);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadImage).toHaveBeenCalledWith(buf);
  });
});
