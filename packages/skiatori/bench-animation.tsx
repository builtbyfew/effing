/**
 * Realistic animation benchmark: skiatori vs satori
 *
 * Simulates Annie-style frame rendering (60 frames per test) comparing:
 *   1. skiatori (png)        — pngFromSkiatori per frame
 *   2. skiatori (pipeline)   — renderToCanvas + async toBuffer (pipelined)
 *   3. satori  (direct)      — pngFromSatori per frame (main thread)
 *   4. satori  (pool)        — createSatoriPool parallel rendering
 *
 * Tests:
 *   1. logo-reveal  (60 frames) — animated shapes, no fonts, no images
 *   2. text-zoom    (60 frames) — text scaling with fonts
 *   3. image-slider (60 frames) — composited images with parallax
 *
 * Run: npx tsx bench-animation.tsx
 */

import { readFileSync } from "node:fs";
import os from "os";
import React from "react";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { pngFromSkiatori, renderToCanvas, Canvas } from "./src/index.ts";

// Easing functions (from @effing/tween, inlined to avoid build dependency)
const easeInCubic = (x: number) => x * x * x;
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeInOutQuad = (x: number) =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const easeInQuad = (x: number) => x * x;

// ---------------------------------------------------------------------------
// satori wrappers (direct + pool-like sequential for fair comparison)
// ---------------------------------------------------------------------------

type FontData = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight: number;
  style: string;
};

type RenderOpts = { width: number; height: number; fonts: FontData[] };

async function pngFromSatori(
  template: Parameters<typeof satori>[0],
  opts: RenderOpts,
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
// Fonts
// ---------------------------------------------------------------------------

const dejaVuData = readFileSync(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
);
const dejaVuBoldData = readFileSync(
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
);

const satoriFont: FontData = {
  name: "DejaVu Sans",
  data: dejaVuData,
  weight: 400,
  style: "normal",
};
const satoriBoldFont: FontData = {
  name: "DejaVu Sans",
  data: dejaVuBoldData,
  weight: 700,
  style: "normal",
};
const skiatoriFont = { ...satoriFont };
const skiatoriBoldFont = { ...satoriBoldFont };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 1080;
const H = 1080;
const FRAME_COUNT = 60;
const MARGINS = { top: 80, left: 80, right: 80, bottom: 80 };

// ---------------------------------------------------------------------------
// Test 1: Logo reveal — animated shapes, no fonts, no images
// ---------------------------------------------------------------------------

function LogoReveal({
  progress,
  width,
  height,
}: {
  progress: number;
  width: number;
  height: number;
}) {
  const p = easeInOutQuad(progress);
  const fadeIn = easeInCubic(progress);
  const boxSize = 90;
  const gap = 20;
  const gridSize = 3;
  const totalSize = gridSize * boxSize + (gridSize - 1) * gap;
  const offsetX = (width - totalSize) / 2;
  const offsetY = (height - totalSize) / 2;

  const boxes: React.ReactElement[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const delay = (row + col) / ((gridSize - 1) * 2);
      const localP = Math.max(0, Math.min(1, (p - delay * 0.5) / 0.5));
      const hue = ((row * gridSize + col) * 40) % 360;
      boxes.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: offsetX + col * (boxSize + gap),
            top: offsetY + row * (boxSize + gap),
            width: boxSize * localP,
            height: boxSize * localP,
            backgroundColor: `hsl(${hue}, 70%, 60%)`,
            borderRadius: 12 * localP,
            opacity: localP,
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        backgroundColor: `rgba(15, 23, 42, ${0.6 + 0.4 * fadeIn})`,
        position: "relative",
      }}
    >
      {boxes}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test 2: Text zoom — text scaling with fonts
// ---------------------------------------------------------------------------

function TextZoom({
  progress,
  width,
  height,
}: {
  progress: number;
  width: number;
  height: number;
}) {
  const zoomFactor = 0.8 + 0.2 * easeInQuad(progress);
  const baseFontSize = 56;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: MARGINS.top,
          left: MARGINS.left,
          right: MARGINS.right,
          bottom: MARGINS.bottom,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "DejaVu Sans",
            fontSize: baseFontSize * zoomFactor,
            fontWeight: 700,
            color: "#1a1a1a",
            textAlign: "center",
            gap: baseFontSize * 0.25,
          }}
        >
          <div>Animated Title</div>
          <div
            style={{
              fontSize: (baseFontSize * 0.5) * zoomFactor,
              fontWeight: 400,
              color: "#64748b",
            }}
          >
            A subtitle that scales with the zoom effect
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test 3: Image slider — composited colored panels with parallax
//
// Uses colored divs instead of real images to avoid network I/O,
// but the layout/compositing complexity mirrors a real carousel.
// ---------------------------------------------------------------------------

function ImageSlider({
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
  const parallaxPct = 0.25;

  const rightMargin = Math.max(MARGINS.right, 2 * MARGINS.left);
  const baseSize = Math.floor(
    (width - MARGINS.left - rightMargin) / (1 + zoomLevel),
  );
  const parallaxStrength = baseSize * parallaxPct;

  const p = progress;
  const previousFactor = 1 + zoomLevel * easeInOutCubic(1 - p);
  const currentFactor = 1 + zoomLevel * easeInOutCubic(p);
  const parallaxOffset =
    parallaxStrength * (0.5 - Math.abs(0.5 - easeInOutSine(p)));

  const panels = [
    { color: "#ef4444", label: "Panel 1" },
    { color: "#22c55e", label: "Panel 2" },
    { color: "#3b82f6", label: "Panel 3" },
  ];
  const factors = [previousFactor, currentFactor, 1];

  return (
    <div style={{ display: "flex", width, height, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: MARGINS.left,
          position: "absolute",
          left: MARGINS.left - (baseSize + MARGINS.left) * easeInOutSine(p),
          top: MARGINS.top,
          bottom: MARGINS.bottom,
        }}
      >
        {panels.map((panel, i) => (
          <div
            key={i}
            style={{
              width: factors[i] * baseSize,
              height: factors[i] * baseSize,
              overflow: "hidden",
              borderRadius,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: factors[i] * baseSize + parallaxStrength,
                height: "100%",
                backgroundColor: panel.color,
                left: parallaxOffset,
              }}
            />
            <div
              style={{
                position: "absolute",
                fontFamily: "DejaVu Sans",
                fontSize: 32,
                fontWeight: 700,
                color: "white",
              }}
            >
              {panel.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frame generators
// ---------------------------------------------------------------------------

type FrameFactory = (progress: number) => React.ReactElement;

function makeLogoRevealFrame(p: number) {
  return <LogoReveal progress={p} width={W} height={H} />;
}

function makeTextZoomFrame(p: number) {
  return <TextZoom progress={p} width={W} height={H} />;
}

function makeImageSliderFrame(p: number) {
  return <ImageSlider progress={p} width={W} height={H} />;
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

type BenchResult = {
  name: string;
  frames: number;
  elapsed: number;
  avgMs: number;
  fps: number;
};

async function benchSkiatoriPng(
  label: string,
  makeFrame: FrameFactory,
  fonts: FontData[],
  frameCount: number,
): Promise<BenchResult> {
  const start = performance.now();
  for (let i = 0; i < frameCount; i++) {
    const p = i / (frameCount - 1);
    await pngFromSkiatori(makeFrame(p), { width: W, height: H, fonts });
  }
  const elapsed = performance.now() - start;
  return {
    name: label,
    frames: frameCount,
    elapsed,
    avgMs: elapsed / frameCount,
    fps: (frameCount / elapsed) * 1000,
  };
}

async function benchSkiatoriPipeline(
  label: string,
  makeFrame: FrameFactory,
  fonts: FontData[],
  frameCount: number,
): Promise<BenchResult> {
  // Pipeline: render frame N on main thread while frame N-1 encodes on a
  // native thread.  Each frame gets its own canvas because we can't draw
  // on a canvas that is still being encoded.
  const encodePromises: Promise<Buffer>[] = [];

  const start = performance.now();
  for (let i = 0; i < frameCount; i++) {
    const p = i / (frameCount - 1);
    const canvas = new Canvas(W, H);
    const ctx = canvas.getContext("2d");
    await renderToCanvas(makeFrame(p), ctx, { width: W, height: H, fonts });
    // kick off async encode — runs on native thread, does not block the
    // main thread so we can immediately start rendering the next frame
    encodePromises.push(canvas.toBuffer("png"));
  }
  // wait for any remaining encodes to finish
  await Promise.all(encodePromises);
  const elapsed = performance.now() - start;
  return {
    name: label,
    frames: frameCount,
    elapsed,
    avgMs: elapsed / frameCount,
    fps: (frameCount / elapsed) * 1000,
  };
}

async function benchSatoriDirect(
  label: string,
  makeFrame: FrameFactory,
  fonts: FontData[],
  frameCount: number,
): Promise<BenchResult> {
  const start = performance.now();
  for (let i = 0; i < frameCount; i++) {
    const p = i / (frameCount - 1);
    await pngFromSatori(makeFrame(p), { width: W, height: H, fonts });
  }
  const elapsed = performance.now() - start;
  return {
    name: label,
    frames: frameCount,
    elapsed,
    avgMs: elapsed / frameCount,
    fps: (frameCount / elapsed) * 1000,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

type TestCase = {
  name: string;
  makeFrame: FrameFactory;
  skiatoriFonts: FontData[];
  satoriFonts: FontData[];
};

const tests: TestCase[] = [
  {
    name: "logo-reveal (no fonts)",
    makeFrame: makeLogoRevealFrame,
    skiatoriFonts: [],
    satoriFonts: [],
  },
  {
    name: "text-zoom (with fonts)",
    makeFrame: makeTextZoomFrame,
    skiatoriFonts: [skiatoriFont, skiatoriBoldFont],
    satoriFonts: [satoriFont, satoriBoldFont],
  },
  {
    name: "image-slider (layout heavy)",
    makeFrame: makeImageSliderFrame,
    skiatoriFonts: [skiatoriFont, skiatoriBoldFont],
    satoriFonts: [satoriFont, satoriBoldFont],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  return ms.toFixed(0).padStart(7) + "ms";
}

function fmtFps(fps: number): string {
  return fps.toFixed(1).padStart(6) + " fps";
}

async function main() {
  console.log("=".repeat(76));
  console.log(
    "  Animation benchmark: skiatori vs satori — %d frames per test",
    FRAME_COUNT,
  );
  console.log("=".repeat(76));
  console.log(`  Resolution: ${W}x${H}`);
  console.log(`  CPU cores:  ${os.cpus().length}`);
  console.log(`  Node.js:    ${process.version}`);
  console.log("");

  // Warmup
  console.log("  Warming up...");
  await pngFromSkiatori(makeLogoRevealFrame(0), {
    width: W,
    height: H,
    fonts: [],
  });
  await pngFromSatori(makeLogoRevealFrame(0), {
    width: W,
    height: H,
    fonts: [],
  });
  console.log("");

  const allResults: {
    test: string;
    skiatoriPng: BenchResult;
    skiatoriPipeline: BenchResult;
    satoriDirect: BenchResult;
  }[] = [];

  for (const t of tests) {
    console.log(`  ${t.name}`);
    console.log(`  ${"─".repeat(70)}`);

    const skiatoriPng = await benchSkiatoriPng(
      "skiatori (png)",
      t.makeFrame,
      t.skiatoriFonts,
      FRAME_COUNT,
    );
    const skiatoriPipeline = await benchSkiatoriPipeline(
      "skiatori (pipeline)",
      t.makeFrame,
      t.skiatoriFonts,
      FRAME_COUNT,
    );
    const satoriDirect = await benchSatoriDirect(
      "satori  (direct)",
      t.makeFrame,
      t.satoriFonts,
      FRAME_COUNT,
    );

    console.log(
      `  skiatori (png)           total: ${fmtMs(skiatoriPng.elapsed)}  avg: ${fmtMs(skiatoriPng.avgMs)}  ${fmtFps(skiatoriPng.fps)}`,
    );
    console.log(
      `  skiatori (pipeline) total: ${fmtMs(skiatoriPipeline.elapsed)}  avg: ${fmtMs(skiatoriPipeline.avgMs)}  ${fmtFps(skiatoriPipeline.fps)}`,
    );
    console.log(
      `  satori   (direct)        total: ${fmtMs(satoriDirect.elapsed)}  avg: ${fmtMs(satoriDirect.avgMs)}  ${fmtFps(satoriDirect.fps)}`,
    );

    const speedup = satoriDirect.elapsed / skiatoriPipeline.elapsed;
    const speedStr =
      speedup >= 1
        ? `${speedup.toFixed(2)}x faster`
        : `${(1 / speedup).toFixed(2)}x slower`;
    console.log(`  → skiatori (pipeline) is ${speedStr} than satori`);
    console.log("");

    allResults.push({ test: t.name, skiatoriPng, skiatoriPipeline, satoriDirect });
  }

  // Summary table
  console.log("=".repeat(76));
  console.log("  Summary (skiatori pipeline vs satori direct)");
  console.log("=".repeat(76));
  console.log(
    "  " +
      "Test".padEnd(30) +
      "Skiatori".padStart(10) +
      "Satori".padStart(10) +
      "Speedup".padStart(10) +
      "Ski FPS".padStart(10),
  );
  console.log("  " + "─".repeat(70));
  for (const r of allResults) {
    const speedup = r.satoriDirect.elapsed / r.skiatoriPipeline.elapsed;
    console.log(
      "  " +
        r.test.padEnd(30) +
        fmtMs(r.skiatoriPipeline.elapsed).padStart(10) +
        fmtMs(r.satoriDirect.elapsed).padStart(10) +
        `${speedup.toFixed(2)}x`.padStart(10) +
        fmtFps(r.skiatoriPipeline.fps).padStart(10),
    );
  }
  console.log("");
}

main().catch(console.error);
