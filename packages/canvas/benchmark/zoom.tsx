// Scratch benchmark: median draw time of a 1080x1080 frame with a zoomed text
// card, at fixed scales and over 60-frame zooms.
import { createCanvas } from "@napi-rs/canvas";
import React from "react";
import { renderReactElement } from "../src/jsx/index.ts";
import { loadFonts } from "../comparison/_helpers/fonts.ts";

const fonts = await loadFonts();
const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext("2d");

const card = (scale: number, counter?: number, extra?: React.CSSProperties) => (
  <div
    style={{
      width: 1080,
      height: 1080,
      display: "flex",
      background: "#101418",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        width: 600,
        display: "flex",
        flexDirection: "column",
        padding: 40,
        borderRadius: 24,
        background: "#fff",
        fontFamily: "Liberation Sans",
        color: "#111",
        transform: `scale(${scale})`,
        ...extra,
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700 }}>Quarterly results</div>
      <div style={{ fontSize: 28, marginTop: 16 }}>
        {`Revenue grew ${counter ?? 23}% year over year, driven by strong demand across every region and a record holiday season.`}
      </div>
    </div>
  </div>
);

// Draws are recorded and only rasterized when pixels are read, so read one to
// time the full frame, as encoding it would.
async function frame(element: React.ReactNode) {
  await renderReactElement(ctx, element, { fonts });
  ctx.getImageData(0, 0, 1, 1);
}

async function median(scales: number[], reps: number) {
  const times: number[] = [];
  for (let r = 0; r < reps; r++) {
    const t = performance.now();
    for (const s of scales) await frame(card(s));
    times.push((performance.now() - t) / scales.length);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

const label = process.env.LABEL ?? "";
await median([1, 1.02, 1.5], 20); // warm up
const rows: string[] = [];
for (const s of [1, 0.9, 1.02, 1.5, 2.02])
  rows.push(`scale ${s}: ${(await median([s], 60)).toFixed(2)} ms`);
const zoom = (to: number) =>
  Array.from({ length: 60 }, (_, i) => 1 + ((to - 1) * i) / 59);
rows.push(`zoom 1→1.5: ${(await median(zoom(1.5), 5)).toFixed(2)} ms/frame`);
rows.push(`zoom 1→3: ${(await median(zoom(3), 5)).toFixed(2)} ms/frame`);
// A counter in the text defeats any per-text caching: every frame lays out
// new text, as a ticking number or typewriter effect would.
let counter = 1000;
const times: number[] = [];
for (let i = 0; i < 200; i++) {
  const t = performance.now();
  await frame(card(1, counter++));
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
rows.push(`new text every frame: ${times[100]!.toFixed(2)} ms`);

async function medianOf(element: React.ReactNode, reps = 60) {
  const t: number[] = [];
  for (let i = 0; i < reps; i++) {
    const start = performance.now();
    await frame(element);
    t.push(performance.now() - start);
  }
  t.sort((a, b) => a - b);
  return t[Math.floor(reps / 2)]!;
}
rows.push(
  `opacity 0.8: ${(await medianOf(card(1, undefined, { opacity: 0.8 }))).toFixed(2)} ms`,
);
rows.push(
  `backdrop blur(12px): ${(
    await medianOf(
      card(1, undefined, {
        background: "rgba(255,255,255,0.4)",
        backdropFilter: "blur(12px)",
      }),
    )
  ).toFixed(2)} ms`,
);
console.log(`BENCH ${label}\n${rows.join("\n")}`);
