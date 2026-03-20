import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../../types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const CLAMP_TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.";

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: text", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    const result = await loadFonts();
    fonts = result.fonts;
  }, 30_000);

  it("renders lineClamp=2 — long text clamped to 2 lines with ellipsis", async () => {
    const W = 300;
    const H = 120;
    const element = (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineClamp: 2,
            fontSize: 20,
            color: "black",
          }}
        >
          {CLAMP_TEXT}
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, W, H, fonts),
      renderWithSatori(element, W, H, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "lineclamp-2-lines",
    );
    expect(percentage).toBeLessThan(3.5);
  });

  it("renders lineClamp=3 — long text clamped to 3 lines with ellipsis", async () => {
    const W = 300;
    const H = 160;
    const element = (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineClamp: 3,
            fontSize: 16,
            color: "black",
          }}
        >
          {CLAMP_TEXT}
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, W, H, fonts),
      renderWithSatori(element, W, H, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "lineclamp-3-lines",
    );
    expect(percentage).toBeLessThan(4);
  });

  it("renders lineClamp with short text — no truncation when text fits", async () => {
    const W = 300;
    const H = 120;
    const shortText = "Short text";
    const element = (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineClamp: 3,
            fontSize: 20,
            color: "black",
          }}
        >
          {shortText}
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, W, H, fonts),
      renderWithSatori(element, W, H, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "lineclamp-short-no-truncation",
    );
    expect(percentage).toBeLessThan(0.2);
  });

  it("renders special characters with multi-word font family", async () => {
    // Register the same Inter font data under a multi-word alias
    const interRegular = fonts.find(
      (f) =>
        f.name === "Liberation Sans" &&
        f.weight === 400 &&
        f.style === "normal",
    )!;
    const testFonts: FontData[] = [
      ...fonts,
      { ...interRegular, name: "Inter Test" },
    ];

    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Inter Test",
          backgroundColor: "white",
          padding: 24,
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 32 }}>{"Price: €42,50"}</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 16 }}>
          {"Résumé — naïve café"}
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 16 }}>
          {"Area: 100m² — 20°C"}
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, testFonts),
      renderWithSatori(element, WIDTH, HEIGHT, testFonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "special-chars-multiword-font",
    );
    expect(percentage).toBeLessThan(1.0);
  });

  it("flex-centered-text — text vertically centered in flex container", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 300,
            height: 100,
            backgroundColor: "#E5E7EB",
            fontSize: 32,
          }}
        >
          Hello World
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "flex-centered-text",
    );
    expect(percentage).toBeLessThan(0.2);
  });

  it("collapses leading whitespace after <br />", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 42,
          fontFamily: "Liberation Sans",
          backgroundColor: "white",
          color: "black",
          width: WIDTH,
          height: HEIGHT,
          padding: 40,
        }}
      >
        First line <br /> second line <br /> third line
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "br-whitespace-collapse",
    );

    expect(percentage).toBeLessThan(0.6);
  });

  it("renders WebkitTextStroke — text with stroke outline", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height: HEIGHT,
          backgroundColor: "#1a1a2e",
          padding: 20,
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontFamily: "Liberation Sans",
            color: "white",
            WebkitTextStrokeWidth: "2px",
            WebkitTextStrokeColor: "#e94560",
          }}
        >
          Stroke
        </div>
        <div
          style={{
            fontSize: 36,
            fontFamily: "Liberation Sans",
            color: "#16213e",
            WebkitTextStroke: "3px #0f3460",
          }}
        >
          Shorthand
        </div>
        <div
          style={{
            fontSize: 28,
            fontFamily: "Liberation Sans",
            color: "white",
            WebkitTextStrokeWidth: "1px",
            WebkitTextStrokeColor: "#e94560",
          }}
        >
          Thin stroke
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "webkit-text-stroke",
    );

    expect(percentage).toBeLessThan(0.7);
  });
});
