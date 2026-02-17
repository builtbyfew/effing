import os from "os";
import { fileURLToPath } from "url";
import path from "path";

import type { ReactNode } from "react";
import type satori from "satori";
import Tinypool from "tinypool";

import type { EmojiStyle } from "../emoji.ts";
import {
  ensureSingleElement,
  expandElement,
  serializeElement,
} from "../serde/index.ts";

export type SatoriPoolOptions = {
  /** Minimum number of worker threads (default: 1) */
  minThreads?: number;
  /** Maximum number of worker threads (default: os.cpus().length) */
  maxThreads?: number;
  /** Absolute path to a bundled worker file (set automatically by the Vite plugin) */
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
  const workerFile =
    options?.workerFile ??
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../worker/index.js",
    );

  const pool = new Tinypool({
    filename: workerFile,
    minThreads: options?.minThreads ?? 1,
    maxThreads: options?.maxThreads ?? os.cpus().length,
  });

  return {
    async renderToPng(element, opts) {
      const serialized = serializeElement(
        ensureSingleElement(expandElement(element as ReactNode)),
      );
      const result = await pool.run(
        {
          element: serialized,
          width: opts.width,
          height: opts.height,
          fonts: opts.fonts,
          emoji: opts.emoji,
        },
        { name: "renderToPng" },
      );
      return Buffer.from(result);
    },

    async renderToSvg(element, opts) {
      const serialized = serializeElement(
        ensureSingleElement(expandElement(element as ReactNode)),
      );
      return pool.run(
        {
          element: serialized,
          width: opts.width,
          height: opts.height,
          fonts: opts.fonts,
          emoji: opts.emoji,
        },
        { name: "renderToSvg" },
      );
    },

    async rasterizeSvgToPng(svg, opts) {
      const result = await pool.run(
        { svg, options: opts },
        { name: "rasterizeSvgToPng" },
      );
      return Buffer.from(result);
    },

    async destroy() {
      await pool.destroy();
    },
  };
}
