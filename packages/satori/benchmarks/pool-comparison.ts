/**
 * Benchmark: full worker pool (serialize JSX + satori + resvg in workers)
 *            vs raster-only pool (satori on main thread, only resvg in workers)
 *
 * Usage:
 *   node --experimental-strip-types benchmarks/pool-comparison.ts
 *   node --experimental-strip-types benchmarks/pool-comparison.ts --frames 120
 *   node --experimental-strip-types benchmarks/pool-comparison.ts --frames 120 --workers 4
 *   node --experimental-strip-types benchmarks/pool-comparison.ts --size 480
 */
import fs from "node:fs";
import os from "node:os";
import React from "react";

import { createSatoriPool, createRasterPool } from "../src/pool/index.ts";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? Number(process.argv[idx + 1]) : fallback;
}

const FRAME_COUNT = arg("frames", 60);
const WORKER_COUNT = arg("workers", os.cpus().length);
const SIZE = arg("size", 1080);
const WIDTH = SIZE;
const HEIGHT = SIZE;

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

const fontData = fs.readFileSync(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
);
const fonts = [
  {
    name: "DejaVu Sans",
    data: fontData,
    weight: 400 as const,
    style: "normal" as const,
  },
];

// ---------------------------------------------------------------------------
// Template — a simple frame with varying text (simulates animation frames)
// ---------------------------------------------------------------------------

const h = React.createElement;

function Frame({ n, total }: { n: number; total: number }) {
  const progress = n / total;
  const barWidth = Math.round(progress * 900);
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#1a1a2e",
        color: "#eee",
        fontFamily: "DejaVu Sans",
        fontSize: 48,
      },
    },
    h(
      "div",
      { style: { display: "flex", marginBottom: 40 } },
      `Frame ${n + 1} / ${total}`,
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          width: 940,
          height: 40,
          backgroundColor: "#333",
          borderRadius: 20,
          overflow: "hidden",
        },
      },
      h("div", {
        style: {
          display: "flex",
          width: barWidth,
          height: 40,
          backgroundColor: "#e94560",
          borderRadius: 20,
        },
      }),
    ),
    h(
      "div",
      {
        style: { display: "flex", marginTop: 40, fontSize: 36, color: "#888" },
      },
      `${Math.round(progress * 100)}%`,
    ),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFrames(): React.ReactNode[] {
  return Array.from({ length: FRAME_COUNT }, (_, i) =>
    h(Frame, { key: i, n: i, total: FRAME_COUNT }),
  );
}

async function bench(label: string, fn: () => Promise<void>): Promise<number> {
  // Warmup — run once to ensure workers are spawned / JIT is warm
  await fn();

  const start = performance.now();
  await fn();
  const elapsed = performance.now() - start;

  const perFrame = elapsed / FRAME_COUNT;
  console.log(
    `  ${label.padEnd(28)} ${elapsed.toFixed(0).padStart(7)} ms total` +
      `  |  ${perFrame.toFixed(1).padStart(6)} ms/frame`,
  );
  return elapsed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nPool comparison benchmark`);
  console.log(
    `  frames=${FRAME_COUNT}  workers=${WORKER_COUNT}  ${WIDTH}x${HEIGHT}\n`,
  );

  const frames = makeFrames();
  const opts = { width: WIDTH, height: HEIGHT, fonts };

  // ---- Full worker pool (current) ----------------------------------------
  const fullPool = createSatoriPool({
    minThreads: WORKER_COUNT,
    maxThreads: WORKER_COUNT,
  });
  const fullMs = await bench("full pool (serialize+worker)", async () => {
    await Promise.all(
      frames.map((el) =>
        fullPool.renderToPng(
          el as Parameters<typeof fullPool.renderToPng>[0],
          opts,
        ),
      ),
    );
  });
  await fullPool.destroy();

  // ---- Raster-only pool (new) --------------------------------------------
  const rasterPool = createRasterPool({
    minThreads: WORKER_COUNT,
    maxThreads: WORKER_COUNT,
  });
  const rasterMs = await bench("raster-only pool (svg>png)", async () => {
    await Promise.all(
      frames.map((el) =>
        rasterPool.renderToPng(
          el as Parameters<typeof rasterPool.renderToPng>[0],
          opts,
        ),
      ),
    );
  });
  await rasterPool.destroy();

  // ---- Summary -----------------------------------------------------------
  const diff = ((rasterMs - fullMs) / fullMs) * 100;
  const faster = diff < 0 ? "raster-only" : "full";
  console.log(
    `\n  => ${faster} pool is ${Math.abs(diff).toFixed(1)}% faster\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
