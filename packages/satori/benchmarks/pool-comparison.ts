/**
 * Benchmark script for annie rendering performance.
 *
 * Usage:
 *   node --experimental-strip-types benchmarks/pool-comparison.ts
 *   node --experimental-strip-types benchmarks/pool-comparison.ts --direct
 *   node --experimental-strip-types benchmarks/pool-comparison.ts --full-pool
 *   node --experimental-strip-types benchmarks/pool-comparison.ts --raster-pool
 *
 * Modes:
 *   (no flag)       — run all three, print comparison
 *   --direct        — direct (main-thread) only
 *   --full-pool     — full worker pool only (serialize JSX + satori + resvg in workers)
 *   --raster-pool   — raster-only pool only (satori on main thread, resvg in workers)
 *
 * Tests:
 * 1. itemwise-logo (60 frames) — pure satori+resvg, no fonts, no images
 * 2. text-zoom (60 frames)     — satori+resvg with fonts
 * 3. thumbnail-carousel (60 frames) — satori+resvg with embedded images, no fonts
 *
 * Reports: total wall time, avg ms/frame, frames/sec
 */
import fs from "node:fs";
import os from "node:os";
import React from "react";

import { pngFromSatori, type FontData } from "../src/index.ts";
import { createSatoriPool, createRasterPool } from "../src/pool/index.ts";

// Import tween utilities from built dist (benchmark-only, not a package dep)
import {
  tween,
  easeInCubic,
  easeInOutCubic,
  easeInOutQuad,
  easeInOutSine,
  easeInQuad,
} from "../../tween/dist/index.js";

const h = React.createElement;

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

const fontData = fs.readFileSync(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
);
const defaultFont: FontData = {
  name: "DejaVu Sans",
  data: fontData,
  weight: 700,
  style: "normal",
};

// ---------------------------------------------------------------------------
// Render function type
// ---------------------------------------------------------------------------

type RenderFn = (
  element: React.ReactNode,
  options: { width: number; height: number; fonts: FontData[] },
) => Promise<Buffer>;

// ---------------------------------------------------------------------------
// direct (no-pool) renderer
// ---------------------------------------------------------------------------

async function renderDirectToPng(
  element: React.ReactNode,
  options: { width: number; height: number; fonts: FontData[] },
): Promise<Buffer> {
  return pngFromSatori(element, options);
}

// ---------------------------------------------------------------------------
// itemwise-logo component
// ---------------------------------------------------------------------------

const BOX_PATH =
  "M78.2444 15.3184C79.3763 14.8939 80.6237 14.8939 81.7556 15.3184L121.756 30.3184C123.707 31.0502 125 32.9158 125 35V85C125 87.0842 123.707 88.9498 121.756 89.6816L81.7556 104.682C80.6237 105.106 79.3763 105.106 78.2444 104.682L38.2444 89.6816C36.2929 88.9498 35 87.0842 35 85V35C35 32.9158 36.2929 31.0502 38.2444 30.3184L78.2444 15.3184ZM45 42.215L75 53.465V92.785L45 81.535V42.215ZM85 92.785L115 81.535V42.215L85 53.465V92.785ZM80 44.66L105.76 35L80 25.34L54.24 35L80 44.66Z";

// Pre-computed with svg-path-properties (avoids runtime dependency)
const BOX_PATH_LENGTH = 564;

function ItemwiseLogoOverlay({
  stroke,
  fill,
  progress,
  width,
  height,
}: {
  stroke: string;
  fill: string | undefined;
  progress: number;
  width: number;
  height: number;
}) {
  return h(
    "svg",
    {
      width,
      height,
      viewBox: "0 0 160 160",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
    },
    h("path", {
      d: "M18.4104 120C19.0694 120 19.6358 120.237 20.1098 120.711C20.5838 121.185 20.8208 121.751 20.8208 122.41C20.8208 123.046 20.5838 123.613 20.1098 124.11C19.6474 124.595 19.0809 124.838 18.4104 124.838C17.763 124.838 17.1965 124.595 16.711 124.11C16.237 123.613 16 123.046 16 122.41C16 121.74 16.2428 121.173 16.7283 120.711C17.2139 120.237 17.7746 120 18.4104 120ZM20.5434 127.491V143.688H16.2775V127.491H20.5434Z",
      fill,
    }),
    h("path", {
      fillRule: "evenodd",
      clipRule: "evenodd",
      d: BOX_PATH,
      stroke,
      strokeDasharray: BOX_PATH_LENGTH / 2,
      strokeDashoffset: (BOX_PATH_LENGTH / 2) * (1 - progress),
      fill,
    }),
  );
}

// ---------------------------------------------------------------------------
// text-zoom component
// ---------------------------------------------------------------------------

function TextZoomOverlay({
  margins,
  text,
  fontFamily = "DejaVu Sans",
  fontSize,
  fontColor = "#000",
  horizontalAlignment = "center",
  verticalAlignment = "center",
  zoomFactor = 1,
}: {
  margins: { top: number; left: number; right: number; bottom: number };
  text: string | string[];
  fontFamily?: string;
  fontSize: number;
  fontColor?: string;
  horizontalAlignment?: "left" | "center" | "right";
  verticalAlignment?: "top" | "center" | "bottom";
  zoomFactor?: number;
}) {
  const lines = Array.isArray(text) ? text : [text];
  return h(
    "div",
    {
      style: {
        display: "flex",
        position: "absolute",
        top: margins.top,
        left: Math.max(margins.left, margins.right),
        right: Math.max(margins.left, margins.right),
        bottom: margins.bottom,
        alignItems: {
          top: "flex-start",
          center: "center",
          bottom: "flex-end",
        }[verticalAlignment],
        justifyContent: {
          left: "flex-start",
          center: "center",
          right: "flex-end",
        }[horizontalAlignment],
      },
    },
    h(
      "div",
      {
        style: {
          fontFamily,
          fontSize: fontSize * zoomFactor,
          fontWeight: "bold",
          color: fontColor,
          display: "flex",
          flexDirection: "column",
          alignItems: {
            left: "flex-start",
            center: "center",
            right: "flex-end",
          }[horizontalAlignment],
          justifyContent: "center",
          textAlign: horizontalAlignment,
          gap: fontSize * 0.25,
          whiteSpace: "nowrap",
          minHeight: "25%",
        },
      },
      ...lines.map((line, index) => h("div", { key: index }, line)),
    ),
  );
}

// ---------------------------------------------------------------------------
// thumbnail-carousel component
// ---------------------------------------------------------------------------

// 1x1 colored PNG data URLs as placeholder images (avoids network I/O)
const PLACEHOLDER_RED =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const PLACEHOLDER_GREEN =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==";
const PLACEHOLDER_BLUE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

const safetyMargins = { top: 80, left: 80, right: 80, bottom: 80 };

function ThumbnailCarouselOverlay({
  progress,
  width,
  height,
}: {
  progress: number;
  width: number;
  height: number;
}) {
  const borderRadius = 24;
  const zoomLevel = 0.5;
  const parallaxPercentage = 0.25;
  const rightMargin = Math.max(safetyMargins.right, 2 * safetyMargins.left);
  const baseSize = Math.floor(
    (width - safetyMargins.left - rightMargin) / (1 + zoomLevel),
  );
  const parallaxStrength = baseSize * parallaxPercentage;

  const p = progress;
  const previousFactor = 1 + zoomLevel * easeInOutCubic(1 - p);
  const currentFactor = 1 + zoomLevel * easeInOutCubic(p);
  const parallaxOffset =
    parallaxStrength * (0.5 - Math.abs(0.5 - easeInOutSine(p)));

  return h(
    "div",
    { style: { display: "flex", width, height, overflow: "hidden" } },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: safetyMargins.left,
          position: "absolute",
          left:
            safetyMargins.left -
            (baseSize + safetyMargins.left) * easeInOutSine(p),
          top: safetyMargins.top,
          bottom: safetyMargins.bottom,
        },
      },
      // Previous thumbnail
      h(
        "div",
        {
          style: {
            width: previousFactor * baseSize,
            height: previousFactor * baseSize,
            overflow: "hidden",
            borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        h("img", {
          src: PLACEHOLDER_RED,
          style: {
            width: previousFactor * baseSize + parallaxStrength,
            height: "100%",
            objectFit: "cover",
            transform: `translateX(${parallaxOffset}px)`,
          },
        }),
      ),
      // Current thumbnail
      h(
        "div",
        {
          style: {
            width: currentFactor * baseSize,
            height: currentFactor * baseSize,
            overflow: "hidden",
            borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        h("img", {
          src: PLACEHOLDER_GREEN,
          style: {
            width: currentFactor * baseSize + parallaxStrength,
            height: "100%",
            objectFit: "cover",
            transform: `translateX(${parallaxOffset}px)`,
          },
        }),
      ),
      // Next thumbnail
      h(
        "div",
        {
          style: {
            width: baseSize,
            height: baseSize,
            overflow: "hidden",
            borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        h("img", {
          src: PLACEHOLDER_BLUE,
          style: {
            width: baseSize + parallaxStrength,
            height: "100%",
            objectFit: "cover",
            transform: `translateX(${parallaxOffset}px)`,
          },
        }),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Benchmark harness
// ---------------------------------------------------------------------------

const W = 1080,
  H = 1080;

async function benchItemwiseLogo(frameCount: number, render: RenderFn) {
  let count = 0;
  for await (const _buf of tween(frameCount, ({ upper: p }) =>
    render(
      h(ItemwiseLogoOverlay, {
        stroke: `rgba(0, 0, 0, ${easeInOutSine(1 - p)})`,
        fill: `rgba(0, 0, 0, ${easeInCubic(p)})`,
        progress: easeInOutQuad(p),
        width: W,
        height: H,
      }),
      { width: W, height: H, fonts: [] },
    ),
  )) {
    count++;
  }
  return count;
}

async function benchTextZoom(
  frameCount: number,
  fonts: FontData[],
  render: RenderFn,
) {
  let count = 0;
  for await (const _buf of tween(frameCount, ({ lower: p }) =>
    render(
      h(TextZoomOverlay, {
        margins: safetyMargins,
        text: "BMW Serie X X5 M Sportpakket",
        fontSize: 56,
        fontFamily: "DejaVu Sans",
        fontColor: "#1a1a1a",
        horizontalAlignment: "center",
        verticalAlignment: "center",
        zoomFactor: 0.8 + 0.2 * easeInQuad(p),
      }),
      { width: W, height: H, fonts },
    ),
  )) {
    count++;
  }
  return count;
}

async function benchThumbnailCarousel(frameCount: number, render: RenderFn) {
  let count = 0;
  for await (const _buf of tween(frameCount, ({ upper: p }) =>
    render(
      h(ThumbnailCarouselOverlay, { progress: p, width: W, height: H }),
      { width: W, height: H, fonts: [] },
    ),
  )) {
    count++;
  }
  return count;
}

interface BenchResult {
  name: string;
  frames: number;
  elapsed: number;
  avgMs: number;
  fps: number;
}

async function runBenchmark(
  name: string,
  fn: () => Promise<number>,
): Promise<BenchResult> {
  console.log(`\n--- ${name} ---`);
  const start = process.hrtime.bigint();
  const frameCount = await fn();
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  const avgMs = elapsed / frameCount;
  const fps = (frameCount / elapsed) * 1000;
  console.log(`  Frames:     ${frameCount}`);
  console.log(`  Total time: ${elapsed.toFixed(0)}ms`);
  console.log(`  Avg/frame:  ${avgMs.toFixed(1)}ms`);
  console.log(`  FPS:        ${fps.toFixed(1)}`);
  return { name, frames: frameCount, elapsed, avgMs, fps };
}

function printComparison(groups: { label: string; results: BenchResult[] }[]) {
  console.log("\n\n========== Comparison ==========\n");

  // Header
  let header = "Test".padEnd(26);
  for (const g of groups) header += g.label.padStart(16);
  console.log(header);
  console.log("-".repeat(header.length));

  // Rows
  const testCount = groups[0].results.length;
  for (let i = 0; i < testCount; i++) {
    let row = groups[0].results[i].name.padEnd(26);
    for (const g of groups) {
      row += `${g.results[i].elapsed.toFixed(0)}ms`.padStart(16);
    }
    console.log(row);
  }
  console.log();

  // Pool-vs-pool comparison (if both pool types ran)
  const fullIdx = groups.findIndex((g) => g.label.includes("Full"));
  const rasterIdx = groups.findIndex((g) => g.label.includes("Raster"));
  if (fullIdx !== -1 && rasterIdx !== -1) {
    console.log("  Full pool vs Raster-only pool:");
    for (let i = 0; i < testCount; i++) {
      const full = groups[fullIdx].results[i].elapsed;
      const raster = groups[rasterIdx].results[i].elapsed;
      const diff = ((full - raster) / full) * 100;
      const label = diff > 0 ? "faster" : "slower";
      console.log(
        `    ${groups[0].results[i].name.padEnd(26)} raster-only is ${Math.abs(diff).toFixed(1)}% ${label}`,
      );
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const explicit =
    args.includes("--direct") ||
    args.includes("--full-pool") ||
    args.includes("--raster-pool");
  const runDirect = !explicit || args.includes("--direct");
  const runFull = !explicit || args.includes("--full-pool");
  const runRaster = !explicit || args.includes("--raster-pool");

  const modes = [
    runDirect && "direct",
    runFull && "full-pool",
    runRaster && "raster-pool",
  ]
    .filter(Boolean)
    .join(" + ");
  console.log(`\nAnnie rendering benchmark (${modes})`);
  console.log(`CPU cores: ${os.cpus().length}`);

  const fonts = [defaultFont];

  // Create pools if needed
  const fullPool = runFull ? createSatoriPool() : undefined;
  const rasterPool = runRaster ? createRasterPool() : undefined;

  // Warm up
  console.log("\nWarming up...");
  if (runDirect) await benchItemwiseLogo(2, renderDirectToPng);
  if (runFull) await benchItemwiseLogo(2, fullPool!.renderToPng);
  if (runRaster) await benchItemwiseLogo(2, rasterPool!.renderToPng);

  const allGroups: { label: string; results: BenchResult[] }[] = [];

  if (runDirect) {
    console.log("\n\n===== Direct (main thread) =====");
    const results: BenchResult[] = [];
    results.push(
      await runBenchmark("itemwise-logo (60f)", () =>
        benchItemwiseLogo(60, renderDirectToPng),
      ),
    );
    results.push(
      await runBenchmark("text-zoom (60f)", () =>
        benchTextZoom(60, fonts, renderDirectToPng),
      ),
    );
    results.push(
      await runBenchmark("thumbnail-carousel (60f)", () =>
        benchThumbnailCarousel(60, renderDirectToPng),
      ),
    );
    allGroups.push({ label: "Direct (ms)", results });
  }

  if (runFull) {
    console.log("\n\n===== Full pool (serialize + worker) =====");
    const results: BenchResult[] = [];
    results.push(
      await runBenchmark("itemwise-logo (60f)", () =>
        benchItemwiseLogo(60, fullPool!.renderToPng),
      ),
    );
    results.push(
      await runBenchmark("text-zoom (60f)", () =>
        benchTextZoom(60, fonts, fullPool!.renderToPng),
      ),
    );
    results.push(
      await runBenchmark("thumbnail-carousel (60f)", () =>
        benchThumbnailCarousel(60, fullPool!.renderToPng),
      ),
    );
    allGroups.push({ label: "Full pool (ms)", results });
  }

  if (runRaster) {
    console.log("\n\n===== Raster-only pool (satori main, resvg worker) =====");
    const results: BenchResult[] = [];
    results.push(
      await runBenchmark("itemwise-logo (60f)", () =>
        benchItemwiseLogo(60, rasterPool!.renderToPng),
      ),
    );
    results.push(
      await runBenchmark("text-zoom (60f)", () =>
        benchTextZoom(60, fonts, rasterPool!.renderToPng),
      ),
    );
    results.push(
      await runBenchmark("thumbnail-carousel (60f)", () =>
        benchThumbnailCarousel(60, rasterPool!.renderToPng),
      ),
    );
    allGroups.push({ label: "Raster pool (ms)", results });
  }

  if (allGroups.length > 1) {
    printComparison(allGroups);
  }

  if (fullPool) await fullPool.destroy();
  if (rasterPool) await rasterPool.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
