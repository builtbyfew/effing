import { annieFrames } from "@effing/annie";
import { decodeQoi, isQoi, readQoiHeader, type QoiHeader } from "./qoi";

export type AnniePlayerState = {
  status: string;
  error: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  frameCount: number;
  currentFrame: number;
  dimensions: { width: number; height: number } | null;
};

export type AnniePlayerEvents = {
  statechange: AnniePlayerState;
  load: { frameCount: number; dimensions: { width: number; height: number } };
  error: Error;
};

export type AnniePlayerOptions = {
  src: string;
  fps?: number;
  autoPlay?: boolean;
};

type EventCallback<T> = (data: T) => void;

/**
 * A loaded frame. PNG and JPEG frames are images the browser decodes;
 * browsers can't decode QOI, so QOI frames keep their bytes and are decoded
 * by {@link decodeQoi} each time they're drawn.
 *
 * Decoding on draw rather than upfront is a memory trade-off. A decoded
 * 1080p frame takes 8 MB, so decoding a 300-frame annie upfront (to
 * `ImageBitmap`s, say) would hold 2.4 GB, while its QOI bytes take a
 * fraction of that: a few percent of it for flat motion graphics, around
 * half for photographic content. Decoding a 1080p frame takes about 0.5-1 ms
 * for flat graphics and 6-12 ms for photographic content or noise in V8 on a
 * recent laptop, within the 33 ms a frame lasts at 30 fps. A cache of
 * decoded frames wouldn't help playback, which loops through every frame in
 * turn, so only the most recent one is kept, to redraw it for free.
 */
type Frame =
  | { kind: "image"; image: HTMLImageElement }
  | { kind: "qoi"; bytes: Uint8Array; header: QoiHeader };

/**
 * Where QOI frames are decoded to: an `ImageData` the decoder writes into,
 * and a frame-sized canvas it's put on, so it can be drawn scaled onto the
 * player's canvas (`putImageData` doesn't scale). Both are reused from frame
 * to frame.
 */
type QoiSurface = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  imageData: ImageData;
  /** The frame whose pixels the canvas holds, or -1 */
  frameIndex: number;
};

function createQoiSurface(width: number, height: number): QoiSurface {
  // OffscreenCanvas keeps the scratch canvas out of the DOM, but Safari
  // before 16.4 has no 2D context for one, so fall back to a detached canvas.
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let context:
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
    context = canvas.getContext("2d");
  }
  if (!context) {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext("2d");
  }
  if (!canvas || !context) {
    throw new Error("Could not create a canvas to decode QOI frames on");
  }
  return {
    canvas,
    context,
    imageData: context.createImageData(width, height),
    frameIndex: -1,
  };
}

/**
 * Framework-agnostic Annie animation player.
 * Handles loading TAR archives of image frames and playing them on a canvas.
 */
export class AnniePlayerCore {
  private src: string;
  private fps: number;
  private autoPlay: boolean;
  private frameInterval: number;

  private frames: Frame[] = [];
  private qoiSurface: QoiSurface | null = null;
  private loadController: AbortController | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;

  private animationFrameId: number | null = null;
  private currentFrameIndex = 0;
  private lastFrameTime = 0;

  private _isLoading = false;
  private _isPlaying = false;
  private _error: string | null = null;
  private _status = "Ready to load animation.";
  private _dimensions: { width: number; height: number } | null = null;

  private listeners: Map<
    keyof AnniePlayerEvents,
    Set<EventCallback<AnniePlayerEvents[keyof AnniePlayerEvents]>>
  > = new Map();

  constructor(options: AnniePlayerOptions) {
    this.src = options.src;
    this.fps = options.fps ?? 30;
    this.autoPlay = options.autoPlay ?? false;
    this.frameInterval = 1000 / this.fps;
  }

  /**
   * Attach a canvas element to render the animation on.
   */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
  }

  /**
   * Detach the canvas and stop playback.
   */
  detachCanvas(): void {
    this.stop();
    this.canvas = null;
    this.context = null;
  }

  /**
   * Get the current state of the player.
   */
  getState(): AnniePlayerState {
    return {
      status: this._status,
      error: this._error,
      isLoading: this._isLoading,
      isPlaying: this._isPlaying,
      frameCount: this.frames.length,
      currentFrame: this.currentFrameIndex,
      dimensions: this._dimensions,
    };
  }

  /**
   * Subscribe to player events.
   */
  on<K extends keyof AnniePlayerEvents>(
    event: K,
    callback: EventCallback<AnniePlayerEvents[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const callbacks = this.listeners.get(event)!;
    callbacks.add(
      callback as EventCallback<AnniePlayerEvents[keyof AnniePlayerEvents]>,
    );

    return () => {
      callbacks.delete(
        callback as EventCallback<AnniePlayerEvents[keyof AnniePlayerEvents]>,
      );
    };
  }

  private emit<K extends keyof AnniePlayerEvents>(
    event: K,
    data: AnniePlayerEvents[K],
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  private emitStateChange(): void {
    this.emit("statechange", this.getState());
  }

  private setStatus(status: string): void {
    this._status = status;
    this.emitStateChange();
  }

  private setError(error: string | null): void {
    this._error = error;
    if (error) {
      this.emit("error", new Error(error));
    }
    this.emitStateChange();
  }

  /**
   * Load the animation from the source URL.
   */
  async load(): Promise<void> {
    if (this._isLoading) return;

    this.stop();
    this._isLoading = true;
    this._error = null;
    this.setStatus("Loading Annie file...");
    this.cleanup();

    const loadedFrames: { index: number; frame: Frame }[] = [];
    const imageLoadPromises: Promise<void>[] = [];
    const objectUrls: string[] = [];
    // Aborted by destroy(), so a load that's still running stops and
    // releases what it loaded instead of filling a destroyed player.
    const controller = new AbortController();
    this.loadController = controller;
    const { signal } = controller;

    try {
      const response = await fetch(this.src, { signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch animation: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error("Response body is null");
      }

      this.setStatus("Extracting frames...");

      for await (const frame of annieFrames(response.body)) {
        if (signal.aborted) break;

        // QOI is detected from its magic rather than the reader's content
        // type, so it doesn't depend on the reader knowing the format.
        if (isQoi(frame.data)) {
          let header: QoiHeader;
          try {
            header = readQoiHeader(frame.data);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Could not load image: ${frame.name} (${message})`);
          }
          loadedFrames.push({
            index: frame.index,
            frame: { kind: "qoi", bytes: frame.data, header },
          });
          continue;
        }

        const blob = new Blob([frame.data as BlobPart], {
          type: frame.contentType,
        });

        const promise = new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            loadedFrames.push({
              index: frame.index,
              frame: { kind: "image", image: img },
            });
            resolve();
          };
          img.onerror = (err) => {
            reject(new Error(`Could not load image: ${frame.name} (${err})`));
          };
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          img.src = objectUrl;
        });
        // If loading fails before Promise.all() below awaits this image
        // (a later QOI frame is invalid, say), its failure is moot.
        promise.catch(() => {});
        imageLoadPromises.push(promise);
      }

      await Promise.all(imageLoadPromises);
      if (signal.aborted) {
        throw new Error("Loading was aborted");
      }

      loadedFrames.sort((a, b) => a.index - b.index);
      this.frames = loadedFrames.map((f) => f.frame);
      const first = this.frames[0];
      this._dimensions =
        first.kind === "qoi"
          ? { width: first.header.width, height: first.header.height }
          : {
              width: first.image.naturalWidth,
              height: first.image.naturalHeight,
            };
      this.loadController = null;
      this._isLoading = false;
      this.setStatus(`Loaded ${this.frames.length} frames. Ready to play.`);

      this.emit("load", {
        frameCount: this.frames.length,
        dimensions: this._dimensions!,
      });

      if (this.autoPlay && this.frames.length > 0) {
        this.play();
      }
    } catch (err) {
      // this.frames is still empty, so cleanup() can't reach these URLs
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      if (signal.aborted) return;
      this.loadController = null;
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      this._isLoading = false;
      this.setError(errorMessage);
      this.setStatus(`Error: ${errorMessage}`);
    }
  }

  /**
   * Start playing the animation from the current frame.
   */
  play(): void {
    if (this._isPlaying || this.frames.length === 0) return;

    this._isPlaying = true;
    this.lastFrameTime = 0;
    this.drawFrame(this.currentFrameIndex);
    // A frame that fails to decode pauses playback and reports an error.
    if (!this._isPlaying) return;
    this.setStatus("Playing...");
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /**
   * Pause the animation at the current frame.
   */
  pause(): void {
    if (!this._isPlaying) return;

    this._isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.setStatus("Paused.");
  }

  /**
   * Stop the animation and reset to the first frame.
   */
  stop(): void {
    this._isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.currentFrameIndex = 0;
    this.lastFrameTime = 0;
  }

  /**
   * Seek to a specific frame. The frame is drawn immediately. Playback state
   * is preserved — if playing, playback continues forward from the new frame.
   */
  seek(frameIndex: number): void {
    if (this.frames.length === 0) return;
    const clamped = Math.max(
      0,
      Math.min(Math.floor(frameIndex), this.frames.length - 1),
    );
    this.lastFrameTime = 0;
    this.drawFrame(clamped);
  }

  private drawFrame(index: number): void {
    const indexChanged = index !== this.currentFrameIndex;
    if (!this.canvas || !this.context) {
      if (indexChanged) {
        this.currentFrameIndex = index;
        this.emitStateChange();
      }
      return;
    }
    const frame = this.frames[index];
    if (!frame) return;
    let source: CanvasImageSource;
    if (frame.kind === "image") {
      source = frame.image;
    } else {
      try {
        source = this.decodeQoiFrame(index, frame.bytes, frame.header);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errorMessage = `Could not decode frame ${index} (${message})`;
        this.pause();
        this.setError(errorMessage);
        this.setStatus(`Error: ${errorMessage}`);
        return;
      }
    }
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    if (indexChanged) {
      this.currentFrameIndex = index;
      this.emitStateChange();
    }
  }

  /**
   * Decode a QOI frame onto the reusable frame-sized canvas, unless that
   * canvas already holds it, and return the canvas to draw from.
   */
  private decodeQoiFrame(
    index: number,
    bytes: Uint8Array,
    { width, height }: QoiHeader,
  ): OffscreenCanvas | HTMLCanvasElement {
    let surface = this.qoiSurface;
    if (
      !surface ||
      surface.imageData.width !== width ||
      surface.imageData.height !== height
    ) {
      surface = createQoiSurface(width, height);
      this.qoiSurface = surface;
    }
    if (surface.frameIndex !== index) {
      // Invalidate first: a failed decode leaves the ImageData half written.
      surface.frameIndex = -1;
      decodeQoi(bytes, surface.imageData.data);
      surface.context.putImageData(surface.imageData, 0, 0);
      surface.frameIndex = index;
    }
    return surface.canvas;
  }

  private animate = (timestamp: number): void => {
    if (!this._isPlaying || this.frames.length === 0) {
      this.animationFrameId = null;
      return;
    }

    if (!this.canvas || !this.context) {
      this.animationFrameId = null;
      return;
    }

    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestamp;
    }

    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = timestamp - (elapsed % this.frameInterval);
      const nextIndex = (this.currentFrameIndex + 1) % this.frames.length;
      this.drawFrame(nextIndex);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Clean up resources (revoke blob URLs, drop decoded QOI pixels).
   */
  cleanup(): void {
    this.frames.forEach((frame) => {
      if (frame.kind === "image" && frame.image.src.startsWith("blob:")) {
        URL.revokeObjectURL(frame.image.src);
      }
    });
    this.frames = [];
    this.qoiSurface = null;
  }

  /**
   * Destroy the player and clean up all resources, including those of a
   * load that's still running.
   */
  destroy(): void {
    this.loadController?.abort();
    this.loadController = null;
    this._isLoading = false;
    this.stop();
    this.cleanup();
    this.detachCanvas();
    this.listeners.clear();
  }
}
