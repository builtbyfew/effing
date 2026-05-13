import { untar } from "@andrewbranch/untar.js";

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
 * Framework-agnostic Annie animation player.
 * Handles loading TAR archives of image frames and playing them on a canvas.
 */
export class AnniePlayerCore {
  private src: string;
  private fps: number;
  private autoPlay: boolean;
  private frameInterval: number;

  private frames: HTMLImageElement[] = [];
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

    const imageFiles: { name: string; image: HTMLImageElement }[] = [];
    const imageLoadPromises: Promise<void>[] = [];

    try {
      const response = await fetch(this.src);
      if (!response.ok) {
        throw new Error(`Failed to fetch animation: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error("Response body is null");
      }

      this.setStatus("Extracting frames...");

      untar(await response.arrayBuffer()).forEach((file) => {
        if (!file.name || file.typeflag !== "0") return;
        if (!file.fileData) return;

        const blob = new Blob([new Uint8Array(file.fileData)]);

        const promise = new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            imageFiles.push({ name: file.name!, image: img });
            if (imageFiles.length === 1) {
              this._dimensions = {
                width: img.naturalWidth,
                height: img.naturalHeight,
              };
            }
            resolve();
          };
          img.onerror = (err) => {
            reject(new Error(`Could not load image: ${file.name} (${err})`));
          };
          img.src = URL.createObjectURL(blob);
        });
        imageLoadPromises.push(promise);
      });

      await Promise.all(imageLoadPromises);

      if (imageFiles.length === 0) {
        throw new Error("No frames found in the TAR file.");
      }

      imageFiles.sort((a, b) => a.name.localeCompare(b.name));
      this.frames = imageFiles.map((f) => f.image);
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
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
    if (indexChanged) {
      this.currentFrameIndex = index;
      this.emitStateChange();
    }
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
   * Clean up resources (revoke blob URLs).
   */
  cleanup(): void {
    this.frames.forEach((img) => {
      if (img.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }
    });
    this.frames = [];
  }

  /**
   * Destroy the player and clean up all resources.
   */
  destroy(): void {
    this.stop();
    this.cleanup();
    this.detachCanvas();
    this.listeners.clear();
  }
}
