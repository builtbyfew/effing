import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";
import { TranslateXCard } from "./_fixtures/layout-cards.tsx";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: layout", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it("renders borderRadius 50% as a circle", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "red",
          }}
        />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "border-radius-50-percent",
    );
    expect(percentage).toBeLessThan(1);
  });

  it("renders percentage translate — left 50% + translate(-50%) centering", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: WIDTH,
          height: HEIGHT,
          backgroundColor: "#f0f0f0",
        }}
      >
        {/* Centered box using the common left:50% + translate(-50%) pattern */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 120,
            height: 60,
            backgroundColor: "#3B82F6",
            borderRadius: 8,
          }}
        />
        {/* Offset box: 25% from left, 75% from top */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "25%",
            top: "75%",
            transform: "translate(-50%, -50%)",
            width: 80,
            height: 40,
            backgroundColor: "#EF4444",
            borderRadius: 8,
          }}
        />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "translate-percent-centering",
    );

    expect(percentage).toBeLessThan(0.01);
  });

  it("renders partial borders with borderRadius — mixed border widths", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 200,
            height: 100,
            backgroundColor: "#F7F8FA",
            borderLeft: "3px solid #222",
            borderRight: "3px solid #222",
            borderBottom: "3px solid #222",
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "partial-border-radius",
    );
    expect(percentage).toBeLessThan(0.1);
  });

  it("renders LayeredGradientCard — multiple stacked CSS gradients", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          backgroundImage:
            "linear-gradient(rgba(75,162,254,0.5) 0%, rgba(75,162,254,0.8) 100%), linear-gradient(90deg, rgb(255,255,255) 0%, rgb(255,255,255) 100%)",
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 700,
            color: "white",
          }}
        >
          Layered Gradients
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
      "layered-gradient-card",
    );

    expect(percentage).toBeLessThan(1);
  });

  it("renders TranslateXCard — translateX transforms on elements", async () => {
    const element = <TranslateXCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "translatex",
    );

    expect(percentage).toBeLessThan(0.01);
  });

  it("renders boxShadow with overflow hidden — shadow not clipped by own overflow", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 200,
            height: 100,
            backgroundColor: "#3B82F6",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "box-shadow-overflow-hidden",
    );
    expect(percentage).toBeLessThan(0.01);
  });

  it("renders mixed scale+translate transform without clipping past layout box", async () => {
    // Repro from the bug report: a pill with transform combining translate
    // with scale used to render clipped at the layout box's right edge,
    // because the offscreen scale buffer was sized to that layout box and
    // the translate-inside-offscreen pushed content past its bounds.
    const W = 800;
    const H = 200;

    const element = (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "black",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 200,
            height: 60,
            backgroundColor: "white",
            borderRadius: 999,
            transform: "translate(80px, 0px) scale(0.9)",
            transformOrigin: "left center",
          }}
        />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, W, H, fonts),
      renderWithSatori(element, W, H, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "mixed-scale-translate",
    );
    expect(percentage).toBeLessThan(0.1);
  });

  it("renders flex-computed text width — text wraps same as satori without explicit width", async () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const W = 220;
    const H = 60;

    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          backgroundColor: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            paddingLeft: 8,
            paddingTop: 8,
          }}
        >
          <span
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              width: "100%",
            }}
          >
            <span style={{ flex: "none", marginRight: 8 }}>
              <div
                style={{
                  display: "flex",
                  width: 28,
                  height: 28,
                  backgroundColor: "#ccc",
                }}
              />
            </span>
            <div
              style={{
                display: "flex",
                marginRight: 40,
                fontSize: 10,
                color: "#646464",
              }}
            >
              {text}
            </div>
          </span>
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
      "flex-computed-text-width",
    );
    expect(percentage).toBeLessThan(2.5);
  });
});
