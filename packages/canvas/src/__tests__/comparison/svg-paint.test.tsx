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

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: SVG paint", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    const result = await loadFonts();
    fonts = result.fonts;
  }, 30_000);

  it("renders SVG with fillRule evenodd — compound path cutouts", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          backgroundColor: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Map pin icon with evenodd cutout */}
        <svg width="120" height="160" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
            fill="#EF4444"
          />
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-fillrule-evenodd",
    );

    expect(percentage).toBeLessThan(1);
  });

  it("renders SVG radialGradient — gradient fill on shapes", async () => {
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
        <svg
          width={300}
          height={200}
          viewBox="0 0 300 200"
          style={{ width: 300, height: 200 }}
        >
          <defs>
            <radialGradient id="rg1">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="100%" stopColor="#4ECDC4" />
            </radialGradient>
            <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
            <linearGradient id="lg2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f093fb" />
              <stop offset="50%" stopColor="#f5576c" />
              <stop offset="100%" stopColor="#4facfe" />
            </linearGradient>
          </defs>
          <rect x={10} y={10} width={120} height={80} fill="url(#rg1)" />
          <rect x={140} y={10} width={150} height={80} fill="url(#lg1)" />
          <circle cx={70} cy={150} r={40} fill="url(#lg2)" />
          <path d="M160 110 h120 v80 H160 z" fill="url(#rg1)" />
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-gradient-fills",
    );
    expect(percentage).toBe(0);
  });

  it("renders SVG fillOpacity and strokeOpacity — semi-transparent shapes", async () => {
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
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          style={{ width: 200, height: 200 }}
        >
          {/* Solid background rect so transparency is visible */}
          <rect x={0} y={0} width={200} height={200} fill="#3B82F6" />
          {/* Semi-transparent overlapping rect */}
          <rect
            x={20}
            y={20}
            width={160}
            height={80}
            fill="#000000"
            fillOpacity={0.3}
          />
          {/* Rect with strokeOpacity */}
          <rect
            x={20}
            y={120}
            width={160}
            height={60}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={6}
            strokeOpacity={0.5}
          />
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-fill-stroke-opacity",
    );
    expect(percentage).toBeLessThan(0.01);
  });

  it("svg-named-color-fill-opacity", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "#1a1a2e",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          style={{ width: 200, height: 200 }}
        >
          <rect
            x={10}
            y={10}
            width={180}
            height={180}
            fill="white"
            fillOpacity={0.5}
          />
          <circle cx={100} cy={100} r={60} fill="red" fillOpacity={0.7} />
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-named-color-fill-opacity",
    );
    expect(percentage).toBeLessThan(0.01);
  });

  it("svg-group-inherited-stroke", async () => {
    const WIDTH = 200;
    const HEIGHT = 200;

    // Paths that inherit stroke from a parent <g> element
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
        <svg
          width={180}
          height={180}
          viewBox="0 0 24 24"
          style={{ width: 180, height: 180 }}
        >
          <g
            fill="none"
            stroke="#E11D48"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </g>
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-group-inherited-stroke",
    );
    expect(percentage).toBeLessThan(0.01);
  });
});
