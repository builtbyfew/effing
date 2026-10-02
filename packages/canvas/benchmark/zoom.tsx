// Benchmark for the paths that scale, text and compositing take: median draw
// time of a 1080x1080 frame with a text card at fixed scales, over zooms, with
// new text every frame, and with opacity and backdrop-filter.
//
// Run with: pnpm tsx benchmark/zoom.tsx
import { createCanvas } from "@effing/skia";
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

// A column of rows fading in one after the other, as a staggered list
// animation does: every row is its own compositing group, with or without
// `overflow: hidden`.
const fadingList = (rows: number, overflow?: "hidden") => (
  <div
    style={{
      width: 1080,
      height: 1080,
      display: "flex",
      flexDirection: "column",
      background: "#101418",
      padding: 60,
      fontFamily: "Liberation Sans",
      color: "#fff",
    }}
  >
    {Array.from({ length: rows }, (_, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
          padding: 20,
          borderRadius: 12,
          background: "#1f2937",
          opacity: (i + 1) / (rows + 1),
          overflow,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: "#38bdf8",
          }}
        />
        <div style={{ fontSize: 30, marginLeft: 20 }}>
          {`Row ${i + 1}: revenue grew year over year`}
        </div>
      </div>
    ))}
  </div>
);

// Words fading in one by one, as a caption animation does: each word is a
// text-only element with its own opacity.
const fadingWords = (words: number) => (
  <div
    style={{
      width: 1080,
      height: 1080,
      display: "flex",
      flexWrap: "wrap",
      alignContent: "flex-start",
      gap: 12,
      background: "#101418",
      padding: 60,
      fontFamily: "Liberation Sans",
      fontSize: 48,
      color: "#fff",
    }}
  >
    {Array.from({ length: words }, (_, i) => (
      <div key={i} style={{ opacity: (i + 1) / (words + 1) }}>
        {["revenue", "grew", "across", "every", "region"][i % 5]}
      </div>
    ))}
  </div>
);

// A page of small text: many glyphs, filled as outlines.
const denseText = (paragraphs: number) => (
  <div
    style={{
      width: 1080,
      height: 1080,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      background: "#fff",
      padding: 24,
      fontFamily: "Liberation Sans",
      fontSize: 18,
      color: "#111",
    }}
  >
    {Array.from({ length: paragraphs }, (_, i) => (
      <div key={i}>
        {"Revenue grew year over year, driven by strong demand across every region and a record holiday season. ".repeat(
          3,
        )}
      </div>
    ))}
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
rows.push(
  `opacity 0.8: ${(await medianOf(card(1, undefined, { opacity: 0.8 }))).toFixed(2)} ms`,
);
rows.push(
  `fading list, 10 rows: ${(await medianOf(fadingList(10))).toFixed(2)} ms`,
);
rows.push(
  `fading list, 10 clipped rows: ${(await medianOf(fadingList(10, "hidden"))).toFixed(2)} ms`,
);
rows.push(
  `40 words fading separately: ${(await medianOf(fadingWords(40))).toFixed(2)} ms`,
);
rows.push(
  `dense text, 12 paragraphs: ${(await medianOf(denseText(12))).toFixed(2)} ms`,
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
