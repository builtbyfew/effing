// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnniePlayerCore, type AnniePlayerState } from "./core";

// --- Minimal TAR builder -----------------------------------------------------
// Produces archives in the subset of the format that untar.js reads: a
// 512-byte header per entry (name, octal size, typeflag "0") followed by the
// file data padded to 512-byte blocks, terminated by two zero blocks.

const encoder = new TextEncoder();

function tarEntry(name: string, data: Uint8Array): Uint8Array {
  const blocks = 1 + Math.ceil(data.length / 512);
  const entry = new Uint8Array(blocks * 512);
  entry.set(encoder.encode(name), 0);
  entry.set(encoder.encode(data.length.toString(8).padStart(11, "0")), 124);
  entry[156] = "0".charCodeAt(0); // typeflag: regular file
  entry.set(data, 512);
  return entry;
}

function buildTar(names: string[]): ArrayBuffer {
  const entries = names.map((name) => tarEntry(name, encoder.encode(name)));
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
      body: {},
      arrayBuffer: async () => tar,
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
    stubFetchWith(buildTar(["frame_1.png", "frame_2.png", "frame_3.png"]));
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

  it("sorts frames by entry name regardless of archive order", async () => {
    // Archive order: b, a, c — so blob:mock-0 is b, blob:mock-1 is a, and
    // blob:mock-2 is c. After sorting, frame 0 must be a and frame 1 must be b.
    stubFetchWith(buildTar(["frame_b.png", "frame_a.png", "frame_c.png"]));
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
    stubFetchWith(buildTar(["frame_1.png", "frame_2.png"]));
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
      "No frames found in the TAR file.",
    );
    const state = player.getState();
    expect(state.error).toBe("No frames found in the TAR file.");
    expect(state.status).toBe("Error: No frames found in the TAR file.");
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
    stubFetchWith(buildTar(["frame_1.png", "frame_2.png", "frame_3.png"]));
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

  it("emits statechange events during loading", async () => {
    stubFetchWith(buildTar(["frame_1.png"]));
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
    stubFetchWith(buildTar(["frame_1.png", "frame_2.png"]));
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

  it("unsubscribes listeners via the function returned by on()", async () => {
    stubFetchWith(buildTar(["frame_1.png"]));
    const player = new AnniePlayerCore({ src: "animation.annie" });
    const onLoad = vi.fn();
    const unsubscribe = player.on("load", onLoad);
    unsubscribe();

    await player.load();

    expect(onLoad).not.toHaveBeenCalled();
  });
});
