import type React from "react";
import { SANS, fixtureModule } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";

// Filters and backdrop filters, compared pixel by pixel with Chrome's
// screenshot: colours, a gradient and text, filtered.

const frame = (
  name: string,
  width: number,
  height: number,
  children: React.ReactNode,
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width,
  height,
  screenshot: true,
  element: (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        width,
        height,
        padding: 10,
        backgroundColor: "white",
        fontFamily: SANS,
        fontSize: 20,
      }}
    >
      {children}
    </div>
  ),
  ...rest,
});

/** Swatches of colour and a gradient, all of it filtered by `filter`. */
const swatches = (filter: string) => (
  <div id="f" style={{ display: "flex", filter }}>
    {["#ef4444", "#22c55e", "#3b82f6", "#facc15", "#a855f7"].map((color) => (
      <div
        key={color}
        style={{ width: 30, height: 60, backgroundColor: color }}
      />
    ))}
    <div
      style={{
        width: 70,
        height: 60,
        backgroundImage: "linear-gradient(90deg, #f97316, #06b6d4)",
      }}
    />
  </div>
);

const FILTERS = [
  "grayscale(1)",
  "grayscale(0.5)",
  "sepia(1)",
  "saturate(2.5)",
  "saturate(0.3)",
  "hue-rotate(90deg)",
  "hue-rotate(200deg)",
  "contrast(1.8)",
  "contrast(0.4)",
  "brightness(1.3)",
  "invert(0.8)",
  "opacity(0.4)",
  "sepia(0.6) hue-rotate(120deg) saturate(2)",
  "grayscale(1) contrast(2) brightness(0.8)",
];

/** A backdrop of swatches, half of it under a box that filters it. */
const backdrop = (backdropFilter: string) => (
  <div style={{ display: "flex", position: "relative" }}>
    {swatches("none")}
    <div
      id="b"
      style={{
        position: "absolute",
        left: 60,
        top: 10,
        width: 120,
        height: 40,
        backdropFilter,
      }}
    />
  </div>
);

const BACKDROP_FILTERS = [
  "grayscale(1)",
  "sepia(1)",
  "saturate(3)",
  "hue-rotate(180deg)",
  "contrast(2)",
  "opacity(0.5)",
  "grayscale(0.5) blur(2px)",
];

/**
 * Flat colours, filtered: canvas's are within 3 levels of Chrome's in every
 * channel (none differ at a pixelmatch threshold of 0.01), so they're held
 * to that, but for a few pixels: a hue 3° off, or a saturation 0.1 off,
 * fails.
 */
const COLOURS = { tolerance: { pixelThreshold: 0.01, pixels: 0.1 } };

/** As `COLOURS`, for a chain that differs by 0.31% at 0.01 (none at 0.015). */
const CHAINED_COLOURS = { tolerance: { pixelThreshold: 0.015, pixels: 0.1 } };

const fixtures: ChromeFixture[] = [
  ...FILTERS.map((filter) =>
    frame(
      `filters by ${filter}`,
      240,
      80,
      swatches(filter),
      filter === "grayscale(1) contrast(2) brightness(0.8)"
        ? CHAINED_COLOURS
        : COLOURS,
    ),
  ),

  // Drop shadows, of the shape painted.
  frame(
    "casts a blurred drop shadow",
    160,
    100,
    <div
      id="f"
      style={{
        width: 100,
        height: 50,
        borderRadius: 16,
        backgroundColor: "#3b82f6",
        filter: "drop-shadow(6px 8px 6px #1e293b)",
      }}
    />,
    // None of its pixels differ at 0.03, where a shadow 1px further off
    // differs by 3.9% (at 0.1, by none), and one blurred 1px more by 0.16%.
    { tolerance: { pixelThreshold: 0.03, pixels: 0.1 } },
  ),
  frame(
    "casts a sharp drop shadow of a circle and a square",
    180,
    100,
    <div
      id="f"
      style={{
        display: "flex",
        gap: 20,
        filter: "drop-shadow(6px 6px 0 #ef4444)",
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: "#22c55e",
        }}
      />
      <div style={{ width: 50, height: 50, backgroundColor: "#3b82f6" }} />
    </div>,
    // 0.03% of pixels differ at 0.03: a shadow 1px further off, or blurred
    // by 1px, differs by 0.37%.
    { tolerance: { pixelThreshold: 0.03, pixels: 0.06 } },
  ),

  // Filters on text.
  frame(
    "filters text by grayscale",
    200,
    60,
    <div
      id="f"
      style={{ fontSize: 32, color: "#ef4444", filter: "grayscale(1)" }}
    >
      Grayed
    </div>,
  ),
  frame(
    "casts a drop shadow of text",
    200,
    60,
    <div
      id="f"
      style={{
        fontSize: 32,
        color: "#1e3a8a",
        filter: "drop-shadow(3px 3px 2px #f97316)",
      }}
    >
      Dropped
    </div>,
    // 0.43% of pixels differ: a ring where the shadow's halo meets the
    // glyphs' edges, which Chrome rasterises heavier on macOS. The blurred
    // drop shadow above holds the shadow's geometry.
    { tolerance: { pixels: 0.7 } },
  ),
  frame(
    "blurs text",
    200,
    60,
    <div id="f" style={{ fontSize: 32, filter: "blur(1.5px)" }}>
      Blurred
    </div>,
  ),

  // Backdrop filters other than blur, brightness and invert.
  ...BACKDROP_FILTERS.map((backdropFilter) =>
    frame(
      `filters the backdrop by ${backdropFilter}`,
      240,
      80,
      backdrop(backdropFilter),
      // A blur's edges differ by more (up to 25 levels).
      backdropFilter.includes("blur") ? {} : COLOURS,
    ),
  ),
];

export default fixtureModule("filters", fixtures);
