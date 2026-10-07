import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import {
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";

// Smoke checks against satori, a loose reference: where canvas and satori
// differ, Chrome is authoritative, and the text tests that pin Chrome's
// numbers (native-text, white-space, br, min-content) are what catch
// regressions in text layout. Each threshold is about twice what's measured
// (logged as "[comparison]"; macOS arm64 and CI's ubuntu x64 agree within
// 0.01%), with a floor of 0.05% for anti-aliasing.
//
// Satori's `normal` line height leaves out the font's line gap, which canvas
// includes, as Chrome does (#180). Tests of more than one line, or of a line
// placed by its box, set `lineHeight: 1` so both draw the same line boxes:
// whole pixels tall at every font size here, which satori and canvas don't
// round alike. A single line centred, or at the top, isn't moved by the line
// gap, and keeps `normal`.
describe("visual comparison: text (satori smoke checks)", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
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
    // 0.006% measured.
    expect(percentage).toBeLessThan(0.05);
  });

  it("renders special characters with multi-word font family", async () => {
    // Register Liberation Sans Regular under a multi-word alias too.
    const regular = fonts.find(
      (f) =>
        f.name === "Liberation Sans" &&
        f.weight === 400 &&
        f.style === "normal",
    )!;
    const testFonts: FontData[] = [
      ...fonts,
      { ...regular, name: "Liberation Test" },
    ];

    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Liberation Test",
          lineHeight: 1,
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
    // 0.010% measured.
    expect(percentage).toBeLessThan(0.05);
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
          lineHeight: 1,
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
    // 0.007% measured.
    expect(percentage).toBeLessThan(0.05);
  });

  it("collapses leading whitespace after <br />", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 42,
          fontFamily: "Liberation Sans",
          lineHeight: 1,
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

    // 0.023% measured.
    expect(percentage).toBeLessThan(0.05);
  });

  it("renders textShadow — shadow inherited by child text nodes", async () => {
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
          fontSize: 48,
          color: "black",
          textShadow: "4px 4px 0 red",
        }}
      >
        Shadow
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "text-shadow",
    );

    // 0.005% measured.
    expect(percentage).toBeLessThan(0.05);
  });

  it("renders textShadow with alpha color — no double-draw", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH,
          height: HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          fontFamily: "Liberation Sans",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 48,
            color: "#FFFFFFBF",
            textShadow: "4px 4px 0 rgba(255, 100, 100, 0.8)",
          }}
        >
          Alpha
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#FFFFFFCC",
            textShadow: "3px 3px 0 rgba(100, 100, 255, 0.8)",
          }}
        >
          Semi-transparent text with shadow
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
      "text-shadow-alpha",
    );

    // 0.045% measured.
    expect(percentage).toBeLessThan(0.1);
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
            lineHeight: 1,
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
            lineHeight: 1,
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
            lineHeight: 1,
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

    // 0.124% measured.
    expect(percentage).toBeLessThan(0.2);
  });
});
