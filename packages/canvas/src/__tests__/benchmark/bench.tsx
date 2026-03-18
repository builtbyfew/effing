/**
 * Benchmark: satori+resvg vs @effing/canvas JSX rendering
 *
 * Run with: pnpm bench
 *
 * Compares rendering performance of a realistic ThumbnailCarouselOverlay
 * component at different batch sizes.
 */

import { Resvg } from "@resvg/resvg-js";
import { createCanvas } from "@napi-rs/canvas";
import { bench, group, run } from "mitata";
import React from "react";
import satori from "satori";

import { renderReactElement } from "../../jsx/index.ts";
import type { FontData } from "../../types.ts";
import { easeInOutCubic, easeInOutSine } from "@effing/tween";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIDTH = 1080;
const HEIGHT = 1080;

const safetyMargins = { top: 60, bottom: 60, left: 60, right: 60 };

// 1x1 colored PNG data URLs as placeholder images (avoids network I/O)
const PLACEHOLDER_RED =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
const PLACEHOLDER_GREEN =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==";
const PLACEHOLDER_BLUE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

// ---------------------------------------------------------------------------
// Font loading (Liberation Sans from cdnfonts.com — OFL licensed)
// ---------------------------------------------------------------------------

const CDNFONTS = "https://fonts.cdnfonts.com/s/277";

async function fetchFont(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch font: ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function loadFonts(): Promise<FontData[]> {
  return Promise.all([
    fetchFont(`${CDNFONTS}/LiberationSans-Regular.woff`).then((data) => ({
      name: "Liberation Sans",
      data,
      weight: 400 as const,
      style: "normal" as const,
    })),
  ]);
}

// ---------------------------------------------------------------------------
// ThumbnailCarouselOverlay component
// ---------------------------------------------------------------------------

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

  return (
    <div style={{ display: "flex", width, height, overflow: "hidden" }}>
      <div
        style={{
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
        }}
      >
        <div
          style={{
            width: previousFactor * baseSize,
            height: previousFactor * baseSize,
            overflow: "hidden",
            borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={PLACEHOLDER_RED}
            style={{
              width: previousFactor * baseSize + parallaxStrength,
              height: "100%",
              objectFit: "cover",
              transform: `translateX(${parallaxOffset}px)`,
            }}
          />
        </div>
        <div
          style={{
            width: currentFactor * baseSize,
            height: currentFactor * baseSize,
            overflow: "hidden",
            borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={PLACEHOLDER_GREEN}
            style={{
              width: currentFactor * baseSize + parallaxStrength,
              height: "100%",
              objectFit: "cover",
              transform: `translateX(${parallaxOffset}px)`,
            }}
          />
        </div>
        <div
          style={{
            width: baseSize,
            height: baseSize,
            overflow: "hidden",
            borderRadius,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={PLACEHOLDER_BLUE}
            style={{
              width: baseSize + parallaxStrength,
              height: "100%",
              objectFit: "cover",
              transform: `translateX(${parallaxOffset}px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------

async function main() {
  const fonts = await loadFonts();

  console.log("JSX Rendering Benchmark: satori+resvg vs @effing/canvas");
  console.log("=========================================================\n");

  for (const batchSize of [1, 10, 100]) {
    const progressValues = Array.from(
      { length: batchSize },
      (_, i) => i / Math.max(batchSize - 1, 1),
    );

    group(`${batchSize} frame${batchSize > 1 ? "s" : ""}`, () => {
      bench("satori+resvg → PNG", async () => {
        for (const progress of progressValues) {
          const element = (
            <ThumbnailCarouselOverlay
              progress={progress}
              width={WIDTH}
              height={HEIGHT}
            />
          );
          const svg = await satori(element, {
            width: WIDTH,
            height: HEIGHT,
            fonts,
          });
          const resvg = new Resvg(svg, {
            font: { loadSystemFonts: false },
          });
          resvg.render().asPng();
        }
      });

      bench("@effing/canvas → PNG", async () => {
        for (const progress of progressValues) {
          const canvas = createCanvas(WIDTH, HEIGHT);
          const ctx = canvas.getContext("2d");
          const element = (
            <ThumbnailCarouselOverlay
              progress={progress}
              width={WIDTH}
              height={HEIGHT}
            />
          );
          await renderReactElement(ctx, element, { fonts });
          canvas.encodeSync("png");
        }
      });

      bench("@effing/canvas render only (no encode)", async () => {
        for (const progress of progressValues) {
          const canvas = createCanvas(WIDTH, HEIGHT);
          const ctx = canvas.getContext("2d");
          const element = (
            <ThumbnailCarouselOverlay
              progress={progress}
              width={WIDTH}
              height={HEIGHT}
            />
          );
          await renderReactElement(ctx, element, { fonts });
        }
      });
    });
  }

  await run();
}

main().catch((error) => {
  console.error(
    "Benchmark failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
