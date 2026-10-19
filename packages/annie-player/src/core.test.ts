// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnniePlayerCore, type AnniePlayerState } from "./core";

// --- Minimal TAR builder -----------------------------------------------------
// Produces archives in the canonical annie shape that annieFrames reads: a
// 512-byte header per entry (name, octal size, typeflag "0", valid checksum)
// followed by the file data padded to 512-byte blocks, terminated by two zero
// blocks.

const encoder = new TextEncoder();

function tarEntry(name: string, data: Uint8Array): Uint8Array {
  const blocks = 1 + Math.ceil(data.length / 512);
  const entry = new Uint8Array(blocks * 512);
  entry.set(encoder.encode(name), 0);
  entry.set(encoder.encode(data.length.toString(8).padStart(11, "0")), 124);
  entry[156] = "0".charCodeAt(0); // typeflag: regular file
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += i >= 148 && i < 156 ? 0x20 : entry[i];
  }
  entry.set(encoder.encode(checksum.toString(8).padStart(6, "0") + "\0 "), 148);
  entry.set(data, 512);
  return entry;
}

function buildTar(
  names: (string | [name: string, data: Uint8Array])[],
): ArrayBuffer {
  const entries = names.map((entry) =>
    typeof entry === "string"
      ? tarEntry(entry, encoder.encode(entry))
      : tarEntry(...entry),
  );
  const totalSize =
    entries.reduce((sum, entry) => sum + entry.length, 0) + 1024;
  const tar = new Uint8Array(totalSize);
  let offset = 0;
  for (const entry of entries) {
    tar.set(entry, offset);
    offset += entry.length;
  }
  return tar.buffer;
}

// --- Minimal QOI builder -----------------------------------------------------
// A width × height image whose pixels are all QOI_OP_RGB ops, so the decoded
// pixels are exactly the given colours, opaque.

function qoiImage(
  width: number,
  height: number,
  rgb: [number, number, number][],
): Uint8Array {
  return new Uint8Array([
    ...encoder.encode("qoif"),
    ...[0, 0, width >> 8, width & 0xff, 0, 0, height >> 8, height & 0xff],
    4, // channels
    0, // colorspace
    ...rgb.flatMap(([r, g, b]) => [0xfe, r, g, b]),
    ...[0, 0, 0, 0, 0, 0, 0, 1],
  ]);
}

// --- Browser API stubs -------------------------------------------------------
// jsdom implements neither image decoding nor blob URLs, so images and the
// object-URL registry are stubbed. Each createObjectURL call returns a unique
// "blob:mock-N" URL where N is the archive order of the frame.

class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  private _src = "";

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    this.naturalWidth = 320;
    this.naturalHeight = 240;
    queueMicrotask(() => this.onload?.());
  }
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function stubFetchWith(tar: ArrayBuffer): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      statusText: "OK",
      // annieFrames accepts plain bytes, so the stubbed body can be the
      // archive itself rather than a ReadableStream.
      body: new Uint8Array(tar),
    })),
  );
}

function fakeCanvas(): {
  canvas: HTMLCanvasElement;
  drawImage: ReturnType<typeof vi.fn>;
} {
  const drawImage = vi.fn();
  const context = { clearRect: vi.fn(), drawImage };
  const canvas = {
    width: 320,
    height: 240,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, drawImage };
}

beforeEach(() => {
  let urlCounter = 0;
  createObjectURL = vi.fn(() => `blob:mock-${urlCounter++}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL =
    createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL =
    revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.unstubAllGlobals();
});

describe("AnniePlayerCore", () => {
  it("starts in an idle state before loading", () => {
    const player = new AnniePlayerCore({ src: "animation.annie" });

    expect(player.getState()).toEqual({
      status: "Ready to load animation.",
      error: null,
      isLoading: false,
      isPlaying: false,
      frameCount: 0,
      currentFrame: 0,
      dimensions: null,
    });
  });

  it("loads frames from a TAR and emits a load event", async () => {
    stubFetchWith(buildTar(["frame_00000", "frame_00001", "frame_00002"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onLoad = vi.fn();
    player.on("load", onLoad);

    await player.load();

    expect(onLoad).toHaveBeenCalledExactlyOnceWith({
      frameCount: 3,
      dimensions: { width: 320, height: 240 },
    });
    const state = player.getState();
    expect(state.frameCount).toBe(3);
    expect(state.status).toBe("Loaded 3 frames. Ready to play.");
    expect(state.error).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.isPlaying).toBe(false); // autoPlay defaults to false
  });

  it("sorts frames by index regardless of archive order", async () => {
    // Archive order: 1, 0, 2 — so blob:mock-0 is frame 1, blob:mock-1 is
    // frame 0, and blob:mock-2 is frame 2. After sorting by index, frame 0
    // must be blob:mock-1 and frame 1 must be blob:mock-0.
    stubFetchWith(buildTar(["frame_00001", "frame_00000", "frame_00002"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();

    const { canvas, drawImage } = fakeCanvas();
    player.attachCanvas(canvas);

    player.seek(0);
    player.seek(1);

    const drawnSrcs = drawImage.mock.calls.map(
      (call) => (call[0] as FakeImage).src,
    );
    expect(drawnSrcs).toEqual(["blob:mock-1", "blob:mock-0"]);
  });

  it("clamps seek to the valid frame range", async () => {
    stubFetchWith(buildTar(["frame_00000", "frame_00001"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();

    player.seek(99);
    expect(player.getState().currentFrame).toBe(1);

    player.seek(-5);
    expect(player.getState().currentFrame).toBe(0);
  });

  it("reports an error when the TAR contains no frames", async () => {
    stubFetchWith(new ArrayBuffer(1024)); // two zero blocks: empty archive
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onError = vi.fn();
    player.on("error", onError);

    await player.load();

    expect(onError).toHaveBeenCalledOnce();
    expect((onError.mock.calls[0][0] as Error).message).toBe(
      "No frames found in the annie archive",
    );
    const state = player.getState();
    expect(state.error).toBe("No frames found in the annie archive");
    expect(state.status).toBe("Error: No frames found in the annie archive");
    expect(state.isLoading).toBe(false);
    expect(state.frameCount).toBe(0);
  });

  it("reports an error when fetching the source fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, statusText: "Not Found" })),
    );
    const player = new AnniePlayerCore({ src: "missing.annie" });
    const onError = vi.fn();
    player.on("error", onError);

    await player.load();

    expect(player.getState().error).toBe(
      "Failed to fetch animation: Not Found",
    );
    expect(onError).toHaveBeenCalledOnce();
  });

  it("revokes every created object URL on destroy", async () => {
    stubFetchWith(buildTar(["frame_00000", "frame_00001", "frame_00002"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();

    expect(createObjectURL).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    player.destroy();

    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    const created = createObjectURL.mock.results.map((r) => r.value as string);
    const revoked = revokeObjectURL.mock.calls.map((call) => call[0] as string);
    expect(revoked.sort()).toEqual(created.sort());
    expect(player.getState().frameCount).toBe(0);
  });

  it("revokes created object URLs when an image fails to decode", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      private _src = "";

      get src(): string {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onerror?.("decode failed"));
      }
    }
    vi.stubGlobal("Image", FailingImage);
    stubFetchWith(buildTar(["frame_00000", "frame_00001"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onError = vi.fn();
    player.on("error", onError);

    await player.load();

    expect(onError).toHaveBeenCalledOnce();
    expect(player.getState().error).toMatch(
      /Could not load image: frame_0000\d/,
    );
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    const created = createObjectURL.mock.results.map((r) => r.value as string);
    const revoked = revokeObjectURL.mock.calls.map((call) => call[0] as string);
    expect(revoked.sort()).toEqual(created.sort());
  });

  it("emits statechange events during loading", async () => {
    stubFetchWith(buildTar(["frame_00000"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const statuses: string[] = [];
    player.on("statechange", (state: AnniePlayerState) => {
      statuses.push(state.status);
    });

    await player.load();

    expect(statuses).toEqual([
      "Loading Annie file...",
      "Extracting frames...",
      "Loaded 1 frames. Ready to play.",
    ]);
  });

  it("starts playback after load when autoPlay is enabled", async () => {
    stubFetchWith(buildTar(["frame_00000", "frame_00001"]));
    const player = new AnniePlayerCore({
      src: "animation.annie",
      autoPlay: true,
    });
    await player.load();

    const state = player.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe("Playing...");

    player.pause();
    expect(player.getState().isPlaying).toBe(false);
    expect(player.getState().status).toBe("Paused.");
  });

  it("stops a load that's still running on destroy, revoking its URLs", async () => {
    const images: DeferredImage[] = [];
    // Loads only when the test calls its onload.
    class DeferredImage {
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      naturalWidth = 320;
      naturalHeight = 240;
      src = "";

      constructor() {
        images.push(this);
      }
    }
    vi.stubGlobal("Image", DeferredImage);
    stubFetchWith(buildTar(["frame_00000", "frame_00001"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onLoad = vi.fn();
    player.on("load", onLoad);

    const loading = player.load();
    await vi.waitFor(() => expect(images).toHaveLength(2));
    player.destroy();
    images.forEach((image) => image.onload?.());
    await loading;

    expect(onLoad).not.toHaveBeenCalled();
    expect(player.getState()).toMatchObject({
      frameCount: 0,
      error: null,
      isLoading: false,
      status: "Ready to load animation.",
    });
    const created = createObjectURL.mock.results.map((r) => r.value as string);
    const revoked = revokeObjectURL.mock.calls.map((call) => call[0] as string);
    expect(created).toHaveLength(2);
    expect(revoked.sort()).toEqual(created.sort());
  });

  it("unsubscribes listeners via the function returned by on()", async () => {
    stubFetchWith(buildTar(["frame_00000"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onLoad = vi.fn();
    const unsubscribe = player.on("load", onLoad);
    unsubscribe();

    await player.load();

    expect(onLoad).not.toHaveBeenCalled();
  });
});

describe("AnniePlayerCore with QOI frames", () => {
  // jsdom has no OffscreenCanvas (nor a 2D context for its canvases), so the
  // canvas QOI frames are decoded onto is stubbed. putImageData records a
  // copy of the pixels, since the player reuses its ImageData.
  let surfaces: FakeOffscreenCanvas[];

  class FakeOffscreenCanvas {
    puts: number[][] = [];
    context = {
      createImageData: (width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: (imageData: { data: Uint8ClampedArray }) => {
        this.puts.push([...imageData.data]);
      },
    };

    constructor(
      public width: number,
      public height: number,
    ) {
      surfaces.push(this);
    }

    getContext(): unknown {
      return this.context;
    }
  }

  beforeEach(() => {
    surfaces = [];
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  });

  const red = qoiImage(2, 1, [
    [255, 0, 0],
    [255, 0, 0],
  ]);
  const green = qoiImage(2, 1, [
    [0, 255, 0],
    [0, 128, 0],
  ]);

  it("loads QOI frames without creating object URLs", async () => {
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", green],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onLoad = vi.fn();
    player.on("load", onLoad);

    await player.load();

    expect(onLoad).toHaveBeenCalledExactlyOnceWith({
      frameCount: 2,
      dimensions: { width: 2, height: 1 },
    });
    expect(player.getState().error).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
    // Nothing is decoded until a frame is drawn.
    expect(surfaces).toHaveLength(0);
  });

  it("decodes a QOI frame when it's drawn and scales it onto the canvas", async () => {
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", green],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();
    const { canvas, drawImage } = fakeCanvas();
    player.attachCanvas(canvas);

    player.seek(1);

    expect(surfaces).toHaveLength(1);
    const [surface] = surfaces;
    expect([surface.width, surface.height]).toEqual([2, 1]);
    expect(surface.puts).toEqual([[0, 255, 0, 255, 0, 128, 0, 255]]);
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(surface, 0, 0, 320, 240);
  });

  it("reuses the decode surface and redraws the same frame without decoding", async () => {
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", green],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();
    const { canvas, drawImage } = fakeCanvas();
    player.attachCanvas(canvas);

    player.seek(0);
    player.seek(0);
    player.seek(1);
    player.seek(0);

    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].puts).toEqual([
      [255, 0, 0, 255, 255, 0, 0, 255],
      [0, 255, 0, 255, 0, 128, 0, 255],
      [255, 0, 0, 255, 255, 0, 0, 255],
    ]);
    expect(drawImage).toHaveBeenCalledTimes(4);
  });

  it("makes a new surface for QOI frames of another size", async () => {
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", qoiImage(1, 1, [[1, 2, 3]])],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();
    player.attachCanvas(fakeCanvas().canvas);

    player.seek(0);
    player.seek(1);

    expect(surfaces.map((s) => [s.width, s.height])).toEqual([
      [2, 1],
      [1, 1],
    ]);
    expect(surfaces[1].puts).toEqual([[1, 2, 3, 255]]);
  });

  it("plays an annie that mixes QOI and other frames", async () => {
    stubFetchWith(
      buildTar([
        "frame_00000", // a stand-in PNG, loaded through an <img>
        ["frame_00001", red],
        "frame_00002",
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onLoad = vi.fn();
    player.on("load", onLoad);
    await player.load();
    const { canvas, drawImage } = fakeCanvas();
    player.attachCanvas(canvas);

    // Dimensions come from the first frame, here an image.
    expect(onLoad).toHaveBeenCalledExactlyOnceWith({
      frameCount: 3,
      dimensions: { width: 320, height: 240 },
    });
    expect(createObjectURL).toHaveBeenCalledTimes(2);

    player.seek(0);
    player.seek(1);
    player.seek(2);

    const sources = drawImage.mock.calls.map((call) => call[0] as unknown);
    expect(sources[0]).toBeInstanceOf(FakeImage);
    expect(sources[1]).toBe(surfaces[0]);
    expect(sources[2]).toBeInstanceOf(FakeImage);
    expect((sources[2] as FakeImage).src).toBe("blob:mock-1");

    player.destroy();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("falls back to a detached canvas without an OffscreenCanvas 2D context", async () => {
    class NoContextOffscreenCanvas {
      getContext(): null {
        return null;
      }
    }
    vi.stubGlobal("OffscreenCanvas", NoContextOffscreenCanvas);
    const fallback = new FakeOffscreenCanvas(0, 0);
    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation(() => fallback as unknown as HTMLElement);
    try {
      stubFetchWith(buildTar([["frame_00000", red]]));
      const player = new AnniePlayerCore({ src: "animation.annie" });
      await player.load();
      const { canvas, drawImage } = fakeCanvas();
      player.attachCanvas(canvas);

      player.seek(0);

      expect(createElement).toHaveBeenCalledWith("canvas");
      expect([fallback.width, fallback.height]).toEqual([2, 1]);
      expect(fallback.puts).toEqual([[255, 0, 0, 255, 255, 0, 0, 255]]);
      expect(drawImage).toHaveBeenCalledWith(fallback, 0, 0, 320, 240);
    } finally {
      createElement.mockRestore();
    }
  });

  it("reports a QOI frame with an invalid header as a load error", async () => {
    const bad = red.slice();
    bad[12] = 5; // channels
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", bad],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onError = vi.fn();
    player.on("error", onError);

    await player.load();

    expect(onError).toHaveBeenCalledOnce();
    expect(player.getState()).toMatchObject({
      error:
        "Could not load image: frame_00001 (Invalid QOI image: 5 channels)",
      frameCount: 0,
      isLoading: false,
    });
  });

  it("stops playing and reports an error when a QOI frame fails to decode", async () => {
    // A valid header, but chunks for only one of the four pixels.
    const corrupt = new Uint8Array([
      ...qoiImage(4, 1, [[9, 9, 9]]).subarray(0, 18),
      ...[0, 0, 0, 0, 0, 0, 0, 1],
    ]);
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", corrupt],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();
    const { canvas, drawImage } = fakeCanvas();
    player.attachCanvas(canvas);
    const onError = vi.fn();
    player.on("error", onError);

    player.play();
    expect(drawImage).toHaveBeenCalledOnce(); // frame 0
    const animate = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    animate(1000);
    animate(1040); // a frame later: frame 1, which fails to decode

    const message =
      "Could not decode frame 1 (Invalid QOI image: data is truncated after 1 of 4 pixels)";
    expect(onError).toHaveBeenCalledOnce();
    expect(player.getState()).toMatchObject({
      isPlaying: false,
      currentFrame: 0,
      error: message,
      status: `Error: ${message}`,
    });
    expect(drawImage).toHaveBeenCalledOnce();
  });

  it("ends the animation loop whose frame failed, even when an error listener restarts playback", async () => {
    const corrupt = new Uint8Array([
      ...qoiImage(4, 1, [[9, 9, 9]]).subarray(0, 18),
      ...[0, 0, 0, 0, 0, 0, 0, 1],
    ]);
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", corrupt],
      ]),
    );
    // Real ids, so the player can tell its loops apart.
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => callbacks.push(callback)),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();
    player.attachCanvas(fakeCanvas().canvas);
    const onError = vi.fn(() => {
      player.seek(0);
      player.play();
    });
    player.on("error", onError);

    player.play(); // requests frame 1
    callbacks[0](1000); // requests frame 2
    callbacks[1](1040); // frame 1 fails; the listener's play() requests frame 3

    expect(onError).toHaveBeenCalledOnce();
    expect(player.getState().isPlaying).toBe(true);
    // Only the restarted loop goes on: frame 2's callback requested none.
    expect(callbacks).toHaveLength(3);
    callbacks[2](2000);
    expect(callbacks).toHaveLength(4);
  });

  it("reports an error when seeking to a QOI frame that fails to decode, and still draws others", async () => {
    const corrupt = qoiImage(2, 1, [
      [9, 9, 9],
      [9, 9, 9],
    ]);
    corrupt[corrupt.length - 1] = 0; // corrupt the end marker
    stubFetchWith(
      buildTar([
        ["frame_00000", red],
        ["frame_00001", corrupt],
      ]),
    );
    const player = new AnniePlayerCore({ src: "animation.annie" });
    await player.load();
    const { canvas, drawImage } = fakeCanvas();
    player.attachCanvas(canvas);

    player.seek(1);
    expect(player.getState().error).toMatch(/^Could not decode frame 1/);
    expect(drawImage).not.toHaveBeenCalled();

    player.seek(0);
    expect(drawImage).toHaveBeenCalledOnce();
  });
});
