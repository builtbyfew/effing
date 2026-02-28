/**
 * Benchmark: @effing/skiatori vs @effing/satori (pngFromSatori)
 *
 * Compares rendering JSX element trees to PNG using:
 *   1. skiatori: JSX → yoga layout → skia-canvas → PNG
 *   2. satori:   JSX → satori (SVG) → resvg → PNG
 *
 * Run: npx tsx bench.ts
 */

import { readFileSync } from "node:fs";
import React from "react";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { pngFromSkiatori } from "./src/index.ts";

async function pngFromSatori(
  template: Parameters<typeof satori>[0],
  opts: { width: number; height: number; fonts: { name: string; data: Buffer; weight: number; style: string }[] },
): Promise<Buffer> {
  const svg = await satori(template, {
    width: opts.width,
    height: opts.height,
    fonts: opts.fonts,
  });
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

// ---------------------------------------------------------------------------
// Font setup
// ---------------------------------------------------------------------------

const fontData = readFileSync(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
);

const satoriFont = {
  name: "DejaVu Sans",
  data: fontData,
  weight: 400 as const,
  style: "normal" as const,
};

const skiatoriFont = {
  name: "DejaVu Sans",
  data: fontData,
  weight: 400,
  style: "normal" as const,
};

// ---------------------------------------------------------------------------
// Test templates
// ---------------------------------------------------------------------------

function simpleBox() {
  return React.createElement("div", {
    style: {
      width: 200,
      height: 200,
      backgroundColor: "#3b82f6",
      borderRadius: 12,
    },
  });
}

function textCard() {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        padding: 40,
        backgroundColor: "#1e293b",
        color: "white",
        fontFamily: "DejaVu Sans",
        width: "100%",
        height: "100%",
      },
    },
    React.createElement(
      "div",
      { style: { fontSize: 48, fontWeight: 700 } },
      "Hello, World!",
    ),
    React.createElement(
      "div",
      { style: { fontSize: 24, color: "#94a3b8", marginTop: 16 } },
      "This is a benchmark comparing skiatori and satori rendering performance.",
    ),
  );
}

function complexLayout() {
  const items = Array.from({ length: 12 }, (_, i) =>
    React.createElement(
      "div",
      {
        key: String(i),
        style: {
          display: "flex",
          alignItems: "center",
          padding: 16,
          backgroundColor: i % 2 === 0 ? "#f1f5f9" : "#e2e8f0",
          borderRadius: 8,
          marginBottom: 8,
        },
      },
      React.createElement("div", {
        style: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `hsl(${i * 30}, 70%, 60%)`,
          marginRight: 16,
        },
      }),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        React.createElement(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 600,
              fontFamily: "DejaVu Sans",
              color: "#1e293b",
            },
          },
          `Item ${i + 1}`,
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: 14,
              fontFamily: "DejaVu Sans",
              color: "#64748b",
              marginTop: 4,
            },
          },
          "A longer description that wraps to multiple lines if needed",
        ),
      ),
    ),
  );

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        padding: 32,
        backgroundColor: "white",
        fontFamily: "DejaVu Sans",
        width: "100%",
        height: "100%",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          fontSize: 36,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 24,
        },
      },
      "Dashboard",
    ),
    ...items,
  );
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

type BenchCase = {
  name: string;
  element: React.ReactElement;
  width: number;
  height: number;
};

const cases: BenchCase[] = [
  { name: "Simple box (200x200)", element: simpleBox(), width: 200, height: 200 },
  { name: "Text card (800x400)", element: textCard(), width: 800, height: 400 },
  { name: "Complex layout (800x900)", element: complexLayout(), width: 800, height: 900 },
];

async function benchmarkCase(c: BenchCase, iterations: number) {
  const { name, element, width, height } = c;

  // Warmup (1 iteration each)
  await pngFromSkiatori(element, { width, height, fonts: [skiatoriFont] });
  await pngFromSatori(element, {
    width,
    height,
    fonts: [satoriFont],
  });

  // Benchmark skiatori
  const skiatoriTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await pngFromSkiatori(element, { width, height, fonts: [skiatoriFont] });
    skiatoriTimes.push(performance.now() - start);
  }

  // Benchmark satori
  const satoriTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await pngFromSatori(element, {
      width,
      height,
      fonts: [satoriFont],
    });
    satoriTimes.push(performance.now() - start);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const min = (arr: number[]) => Math.min(...arr);

  const skiAvg = avg(skiatoriTimes);
  const satAvg = avg(satoriTimes);
  const speedup = satAvg / skiAvg;

  return {
    name,
    skiatori: { avg: skiAvg, median: median(skiatoriTimes), min: min(skiatoriTimes) },
    satori: { avg: satAvg, median: median(satoriTimes), min: min(satoriTimes) },
    speedup,
  };
}

async function main() {
  const iterations = 20;

  console.log("=".repeat(72));
  console.log("  @effing/skiatori vs @effing/satori — PNG Rendering Benchmark");
  console.log("=".repeat(72));
  console.log(`  Iterations per case: ${iterations}`);
  console.log(`  Node.js: ${process.version}`);
  console.log("");

  for (const c of cases) {
    const result = await benchmarkCase(c, iterations);
    const speedStr =
      result.speedup >= 1
        ? `${result.speedup.toFixed(2)}x faster`
        : `${(1 / result.speedup).toFixed(2)}x slower`;

    console.log(`  ${result.name}`);
    console.log(`  ${"─".repeat(60)}`);
    console.log(
      `  skiatori  avg: ${result.skiatori.avg.toFixed(1).padStart(7)}ms` +
        `  median: ${result.skiatori.median.toFixed(1).padStart(7)}ms` +
        `  min: ${result.skiatori.min.toFixed(1).padStart(7)}ms`,
    );
    console.log(
      `  satori   avg: ${result.satori.avg.toFixed(1).padStart(7)}ms` +
        `  median: ${result.satori.median.toFixed(1).padStart(7)}ms` +
        `  min: ${result.satori.min.toFixed(1).padStart(7)}ms`,
    );
    console.log(`  → skiatori is ${speedStr}`);
    console.log("");
  }

  console.log("=".repeat(72));
}

main().catch(console.error);
