// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnniePlayerState } from "../core";
import { AnniePlayer, type AnniePlayerRootProps } from "./index";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- An annie of `count` stand-in frames, in the canonical TAR shape ---------

const encoder = new TextEncoder();

function annie(count: number): Uint8Array<ArrayBuffer> {
  const entries = Array.from({ length: count }, (_, i) => {
    const name = `frame_${String(i).padStart(5, "0")}`;
    const entry = new Uint8Array(1024);
    entry.set(encoder.encode(name), 0);
    entry.set(encoder.encode(name.length.toString(8).padStart(11, "0")), 124);
    entry[156] = 0x30;
    let checksum = 0;
    for (let j = 0; j < 512; j++) {
      checksum += j >= 148 && j < 156 ? 0x20 : entry[j];
    }
    entry.set(
      encoder.encode(checksum.toString(8).padStart(6, "0") + "\0 "),
      148,
    );
    entry.set(encoder.encode(name), 512);
    return entry;
  });
  const tar = new Uint8Array(count * 1024 + 1024);
  entries.forEach((entry, i) => tar.set(entry, i * 1024));
  return tar;
}

// --- Browser API stubs (jsdom decodes no images and has no 2D context) -------

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
    this.naturalWidth = 200;
    this.naturalHeight = 100;
    queueMicrotask(() => this.onload?.());
  }
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let fetchMock: ReturnType<
  typeof vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>
>;
/** Responses by URL; a pending promise holds that URL's load back. */
let responses: Map<string, Promise<Uint8Array<ArrayBuffer>>>;
let drawImage: ReturnType<typeof vi.fn>;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  responses = new Map();
  fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    statusText: "OK",
    body: await responses.get(url)!,
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  let urls = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${urls++}`);
  URL.revokeObjectURL = vi.fn();
  drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Render a Root with a canvas, recording every state it renders. */
function renderPlayer(
  props: Omit<AnniePlayerRootProps, "children" | "height">,
  { strict = false } = {},
) {
  const states: AnniePlayerState[] = [];
  const element = (
    <AnniePlayer.Root height={100} {...props}>
      {({ state, canvasRef }) => {
        states.push(state);
        return <canvas ref={canvasRef} />;
      }}
    </AnniePlayer.Root>
  );
  act(() => root.render(strict ? <StrictMode>{element}</StrictMode> : element));
  return states;
}

/** Let fetches, frame extraction and image loads settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const latest = (states: AnniePlayerState[]) => states[states.length - 1];

describe("AnniePlayer.Root", () => {
  it("loads a new src when it changes with autoLoad on", async () => {
    responses.set("/a.annie", Promise.resolve(annie(2)));
    responses.set("/b.annie", Promise.resolve(annie(3)));
    let states = renderPlayer({ src: "/a.annie", autoLoad: true });
    await settle();
    expect(latest(states)).toMatchObject({ frameCount: 2, isLoading: false });

    states = renderPlayer({ src: "/b.annie", autoLoad: true });
    await settle();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/a.annie",
      "/b.annie",
    ]);
    expect(latest(states)).toMatchObject({
      frameCount: 3,
      isLoading: false,
      status: "Loaded 3 frames. Ready to play.",
    });
  });

  it("loads a new src that replaces one still loading", async () => {
    let resolveA!: (bytes: Uint8Array<ArrayBuffer>) => void;
    responses.set("/a.annie", new Promise((resolve) => (resolveA = resolve)));
    responses.set("/b.annie", Promise.resolve(annie(3)));
    renderPlayer({ src: "/a.annie", autoLoad: true });
    await settle();

    const states = renderPlayer({ src: "/b.annie", autoLoad: true });
    await settle();
    expect(latest(states)).toMatchObject({ frameCount: 3, isLoading: false });

    // The first load, finishing late, leaves the new player's state alone.
    resolveA(annie(2));
    await settle();
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(latest(states)).toMatchObject({ frameCount: 3, isLoading: false });
  });

  it("starts a new player from its own state when src changes without autoLoad", async () => {
    responses.set("/a.annie", Promise.resolve(annie(2)));
    let states = renderPlayer({ src: "/a.annie", autoLoad: true });
    await settle();

    states = renderPlayer({ src: "/b.annie" });
    await settle();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(latest(states)).toMatchObject({
      frameCount: 0,
      isLoading: false,
      status: "Ready to load animation.",
    });
  });

  it("gives a new player the canvas, so autoPlay draws on it", async () => {
    responses.set("/a.annie", Promise.resolve(annie(2)));
    responses.set("/b.annie", Promise.resolve(annie(3)));
    renderPlayer({ src: "/a.annie", autoLoad: true, autoPlay: true });
    await settle();
    drawImage.mockClear();

    const states = renderPlayer({
      src: "/b.annie",
      autoLoad: true,
      autoPlay: true,
    });
    await settle();

    expect(latest(states)).toMatchObject({ frameCount: 3, isPlaying: true });
    // play() draws the first frame of the new annie straight away.
    expect(drawImage).toHaveBeenCalledOnce();
    expect((drawImage.mock.calls[0][0] as FakeImage).src).toBe("blob:mock-2");
  });

  it.each([
    ["fps", { fps: 24 }],
    ["autoPlay", { autoPlay: true }],
  ])(
    "reloads when %s recreates the player",
    async (_option, change: Partial<AnniePlayerRootProps>) => {
      responses.set("/a.annie", Promise.resolve(annie(2)));
      renderPlayer({ src: "/a.annie", autoLoad: true });
      await settle();

      const states = renderPlayer({
        src: "/a.annie",
        autoLoad: true,
        ...change,
      });
      await settle();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(latest(states)).toMatchObject({ frameCount: 2, isLoading: false });
    },
  );

  it("loads once under StrictMode", async () => {
    responses.set("/a.annie", Promise.resolve(annie(2)));
    const states = renderPlayer(
      { src: "/a.annie", autoLoad: true },
      { strict: true },
    );
    await settle();

    // StrictMode creates, destroys and recreates the player: the first
    // player's load is aborted, and the second player loads once.
    const signals = fetchMock.mock.calls.map(([, init]) => init?.signal);
    expect(signals).toHaveLength(2);
    expect(signals.map((signal) => signal?.aborted)).toEqual([true, false]);
    expect(latest(states)).toMatchObject({ frameCount: 2, isLoading: false });
  });

  it("loads when autoLoad is turned on, but not again once loaded", async () => {
    responses.set("/a.annie", Promise.resolve(annie(2)));
    renderPlayer({ src: "/a.annie" });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();

    let states = renderPlayer({ src: "/a.annie", autoLoad: true });
    await settle();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(latest(states)).toMatchObject({ frameCount: 2 });

    renderPlayer({ src: "/a.annie", autoLoad: false });
    states = renderPlayer({ src: "/a.annie", autoLoad: true });
    await settle();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(latest(states)).toMatchObject({ frameCount: 2 });
  });
});
