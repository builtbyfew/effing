// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQoiAsPngUrl, qoiToPngBlob } from "./qoi-image";

// A 2×1 QOI image: one red pixel and one half-transparent blue one.
const qoi = new Uint8Array([
  ...[0x71, 0x6f, 0x69, 0x66, 0, 0, 0, 2, 0, 0, 0, 1, 4, 0],
  ...[0xfe, 255, 0, 0],
  ...[0xff, 0, 0, 255, 128],
  ...[0, 0, 0, 0, 0, 0, 0, 1],
]);
const pixels = [255, 0, 0, 255, 0, 0, 255, 128];

// jsdom has neither OffscreenCanvas nor a 2D context for its canvases, so
// both are stubbed: their "PNG" is a Blob of the pixels put on them.
function fakeContext(canvas: { puts: number[][] }) {
  return {
    createImageData: (width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: (imageData: { data: Uint8ClampedArray }) => {
      canvas.puts.push([...imageData.data]);
    },
  };
}

class FakeOffscreenCanvas {
  static instances: FakeOffscreenCanvas[] = [];
  puts: number[][] = [];

  constructor(
    public width: number,
    public height: number,
  ) {
    FakeOffscreenCanvas.instances.push(this);
  }

  getContext() {
    return fakeContext(this);
  }

  async convertToBlob(options: { type: string }): Promise<Blob> {
    return new Blob([JSON.stringify(this.puts)], { type: options.type });
  }
}

// jsdom has no blob URLs either.
const originalCreateObjectURL = URL.createObjectURL;
let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;

beforeEach(() => {
  FakeOffscreenCanvas.instances = [];
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  createObjectURL = vi.fn(() => "blob:converted");
  URL.createObjectURL = createObjectURL;
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("qoiToPngBlob", () => {
  it("decodes onto an OffscreenCanvas and encodes it as PNG", async () => {
    const blob = await qoiToPngBlob(qoi);

    expect(blob.type).toBe("image/png");
    const [canvas] = FakeOffscreenCanvas.instances;
    expect([canvas.width, canvas.height]).toEqual([2, 1]);
    expect(canvas.puts).toEqual([pixels]);
  });

  it("falls back to a canvas element without OffscreenCanvas", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    const canvas = document.createElement("canvas");
    const state = { puts: [] as number[][] };
    vi.spyOn(canvas, "getContext").mockReturnValue(
      fakeContext(state) as unknown as CanvasRenderingContext2D,
    );
    const toBlob = vi
      .spyOn(canvas, "toBlob")
      .mockImplementation((callback, type) =>
        callback(new Blob([JSON.stringify(state.puts)], { type })),
      );
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    const blob = await qoiToPngBlob(qoi);

    expect(blob.type).toBe("image/png");
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect([canvas.width, canvas.height]).toEqual([2, 1]);
    expect(state.puts).toEqual([pixels]);
  });

  it("rejects an invalid QOI image", async () => {
    await expect(qoiToPngBlob(qoi.subarray(0, 20))).rejects.toThrow(
      "Invalid QOI image",
    );
  });
});

describe("fetchQoiAsPngUrl", () => {
  function stubFetch(body: Uint8Array<ArrayBuffer>, init: ResponseInit = {}) {
    const fetch = vi.fn(async () => new Response(body, init));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("returns an object URL for a PNG of a QOI image", async () => {
    const fetch = stubFetch(qoi);
    const controller = new AbortController();

    const url = await fetchQoiAsPngUrl("https://example.com/image", {
      signal: controller.signal,
    });

    expect(url).toBe("blob:converted");
    expect(fetch).toHaveBeenCalledWith("https://example.com/image", {
      signal: controller.signal,
    });
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("image/png");
  });

  it("returns null for an image that isn't QOI", async () => {
    stubFetch(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    expect(await fetchQoiAsPngUrl("https://example.com/image.png")).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects when the fetch fails", async () => {
    stubFetch(new Uint8Array(0), { status: 404, statusText: "Not Found" });

    await expect(
      fetchQoiAsPngUrl("https://example.com/missing"),
    ).rejects.toThrow("Failed to fetch image: Not Found");
  });
});
