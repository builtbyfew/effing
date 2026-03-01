import os from "os";
import { fileURLToPath } from "url";

import type { ReactNode } from "react";
import type satori from "satori";

import type { EmojiStyle } from "../emoji.ts";
import { svgFromSatori, type SatoriOptions } from "../index.ts";
import {
  ensureSingleElement,
  expandElement,
  serializeElement,
} from "../elements/index.ts";
import { WorkerPool } from "./worker-pool.ts";

export type SatoriPoolOptions = {
  /** Minimum number of worker threads (default: 1) */
  minThreads?: number;
  /** Maximum number of worker threads (default: os.cpus().length) */
  maxThreads?: number;
  /** Absolute path to a bundled worker file */
  workerFile?: string;
};

export type SatoriPool = {
  /** Render a serialized React element to PNG via the worker pool */
  renderToPng(
    element: Parameters<typeof satori>[0],
    options: {
      width: number;
      height: number;
      fonts: Array<{
        name: string;
        data: Buffer | ArrayBuffer;
        weight: number;
        style: string;
      }>;
      emoji?: EmojiStyle;
    },
  ): Promise<Buffer>;

  /** Render a serialized React element to SVG via the worker pool */
  renderToSvg(
    element: Parameters<typeof satori>[0],
    options: {
      width: number;
      height: number;
      fonts: Array<{
        name: string;
        data: Buffer | ArrayBuffer;
        weight: number;
        style: string;
      }>;
      emoji?: EmojiStyle;
    },
  ): Promise<string>;

  /** Rasterize an SVG string to PNG via the worker pool */
  rasterizeSvgToPng(
    svg: string,
    options?: {
      fitTo?:
        | { mode: "original" }
        | { mode: "width"; value: number }
        | { mode: "height"; value: number }
        | { mode: "zoom"; value: number };
      crop?: {
        left: number;
        top: number;
        right?: number;
        bottom?: number;
      };
    },
  ): Promise<Buffer>;

  /** Shut down the worker pool */
  destroy(): Promise<void>;
};

/**
 * Create a worker pool for parallelized satori rendering.
 *
 * @param options Pool configuration
 * @returns A `SatoriPool` with `renderToPng`, `renderToSvg`, `rasterizeSvgToPng`, and `destroy`
 */
export function createSatoriPool(options?: SatoriPoolOptions): SatoriPool {
  let resolvedWorkerUrl: string;
  try {
    resolvedWorkerUrl = import.meta.resolve("@effing/satori/worker");
  } catch {
    // Vite's SSR module runner doesn't support import.meta.resolve;
    // fall back to relative resolution (works in dev where import.meta.url
    // still points at the source file inside node_modules).
    resolvedWorkerUrl = new URL("../worker/index.js", import.meta.url).href;
  }
  const workerFile = options?.workerFile ?? fileURLToPath(resolvedWorkerUrl);

  const pool = new WorkerPool({
    workerFile,
    minThreads: options?.minThreads ?? 1,
    maxThreads: options?.maxThreads ?? os.cpus().length,
  });

  return {
    async renderToPng(element, opts) {
      const serialized = serializeElement(
        ensureSingleElement(expandElement(element as ReactNode)),
      );
      const result = (await pool.run(
        {
          element: serialized,
          width: opts.width,
          height: opts.height,
          fonts: opts.fonts,
          emoji: opts.emoji,
        },
        { name: "renderToPng" },
      )) as Uint8Array;
      return Buffer.from(result);
    },

    async renderToSvg(element, opts) {
      const serialized = serializeElement(
        ensureSingleElement(expandElement(element as ReactNode)),
      );
      return (await pool.run(
        {
          element: serialized,
          width: opts.width,
          height: opts.height,
          fonts: opts.fonts,
          emoji: opts.emoji,
        },
        { name: "renderToSvg" },
      )) as string;
    },

    async rasterizeSvgToPng(svg, opts) {
      const result = (await pool.run(
        { svg, options: opts },
        { name: "rasterizeSvgToPng" },
      )) as Uint8Array;
      return Buffer.from(result);
    },

    async destroy() {
      await pool.destroy();
    },
  };
}

export type RasterPool = {
  /**
   * Render a React element to PNG.
   * SVG generation (satori) runs on the main thread;
   * only the PNG rasterization (resvg) is dispatched to workers.
   */
  renderToPng(
    element: Parameters<typeof satori>[0],
    options: {
      width: number;
      height: number;
      fonts: Array<{
        name: string;
        data: Buffer | ArrayBuffer;
        weight: number;
        style: string;
      }>;
      emoji?: EmojiStyle;
    },
  ): Promise<Buffer>;

  /** Rasterize an SVG string to PNG via the worker pool */
  rasterizeSvgToPng(
    svg: string,
    options?: {
      fitTo?:
        | { mode: "original" }
        | { mode: "width"; value: number }
        | { mode: "height"; value: number }
        | { mode: "zoom"; value: number };
      crop?: {
        left: number;
        top: number;
        right?: number;
        bottom?: number;
      };
    },
  ): Promise<Buffer>;

  /** Shut down the worker pool */
  destroy(): Promise<void>;
};

/**
 * Create a worker pool that only parallelizes PNG rasterization (resvg).
 *
 * SVG generation with satori runs on the main thread — this avoids the
 * overhead of serializing/deserializing React element trees across threads.
 * Only the CPU-heavy resvg PNG rendering is dispatched to worker threads.
 */
export function createRasterPool(options?: SatoriPoolOptions): RasterPool {
  let resolvedWorkerUrl: string;
  try {
    resolvedWorkerUrl = import.meta.resolve("@effing/satori/worker");
  } catch {
    resolvedWorkerUrl = new URL("../worker/index.js", import.meta.url).href;
  }
  const workerFile = options?.workerFile ?? fileURLToPath(resolvedWorkerUrl);

  const pool = new WorkerPool({
    workerFile,
    minThreads: options?.minThreads ?? 1,
    maxThreads: options?.maxThreads ?? os.cpus().length,
  });

  return {
    async renderToPng(element, opts) {
      // SVG generation on the main thread — no serialization needed
      const svg = await svgFromSatori(element, opts as SatoriOptions);
      // Only the PNG rasterization goes to a worker
      const result = (await pool.run(
        { svg },
        { name: "rasterizeSvgToPng" },
      )) as Uint8Array;
      return Buffer.from(result);
    },

    async rasterizeSvgToPng(svg, opts) {
      const result = (await pool.run(
        { svg, options: opts },
        { name: "rasterizeSvgToPng" },
      )) as Uint8Array;
      return Buffer.from(result);
    },

    async destroy() {
      await pool.destroy();
    },
  };
}
