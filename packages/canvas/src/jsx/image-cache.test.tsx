import { afterEach, describe, expect, it, vi } from "vitest";

import { createCanvas, renderReactElement } from "../index.ts";
import type { ImageCache } from "../image.ts";

const HAS_NATIVE_DEPS = (() => {
  try {
    require.resolve("@napi-rs/canvas");
    return true;
  } catch {
    return false;
  }
})();

const URL = "https://example.com/photo.png";

describe.skipIf(!HAS_NATIVE_DEPS)(
  "renderReactElement options.imageCache",
  () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    async function setup() {
      // Real encoded PNG bytes so the native loader can decode the "remote"
      // image without touching the network.
      const png = await createCanvas(2, 2).encode("png");
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () =>
          png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const ctx = createCanvas(8, 8).getContext("2d");
      const element = <img src={URL} style={{ width: 8, height: 8 }} />;
      return { fetchMock, ctx, element };
    }

    it("fetches the same source once per call by default", async () => {
      const { fetchMock, ctx, element } = await setup();

      await renderReactElement(ctx, element, {});
      await renderReactElement(ctx, element, {});

      // One fetch per call (the per-call cache already dedups the layout and
      // draw phases within a call), re-fetched on the second call.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("fetches the same source once across calls sharing a cache", async () => {
      const { fetchMock, ctx, element } = await setup();

      const imageCache: ImageCache = new Map();
      await renderReactElement(ctx, element, { imageCache });
      await renderReactElement(ctx, element, { imageCache });
      await renderReactElement(ctx, element, { imageCache });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(imageCache.size).toBe(1);
    });
  },
);
