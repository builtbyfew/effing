import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
  renderWithSatori,
  compareImages,
  makeTestImage,
  WIDTH,
  HEIGHT,
} from "./_helpers/setup.ts";
import {
  BlurShowcaseCard,
  ObjectFitCoverCard,
  BackgroundImageCard,
} from "./_fixtures/image-cards.tsx";

// ---------------------------------------------------------------------------
// Test case data
// ---------------------------------------------------------------------------

const backgroundImageCases: {
  label: string;
  backgroundSize?: string;
}[] = [
  { label: "default tiling" },
  { label: "cover", backgroundSize: "cover" },
  { label: "contain", backgroundSize: "contain" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: image", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it("renders BlurShowcaseCard — filter blur on div and image", async () => {
    const imageDataUri = await makeTestImage(120, 120);
    const element = (
      <BlurShowcaseCard
        width={WIDTH}
        height={HEIGHT}
        imageDataUri={imageDataUri}
      />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "blur-showcase",
    );

    expect(percentage).toBeLessThan(1);
  });

  it("renders ObjectFitCoverCard — objectFit cover with cropping", async () => {
    const imageDataUri = await makeTestImage(160, 80); // landscape image
    const element = (
      <ObjectFitCoverCard
        width={WIDTH}
        height={HEIGHT}
        imageDataUri={imageDataUri}
      />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "objectfit-cover",
    );

    expect(percentage).toBeLessThan(0.01);
  });

  it.each(backgroundImageCases)(
    "renders backgroundImage — $label",
    async ({ label, backgroundSize }) => {
      const imageDataUri = await makeTestImage(160, 80); // landscape image
      const element = (
        <BackgroundImageCard
          width={WIDTH}
          height={HEIGHT}
          imageDataUri={imageDataUri}
          backgroundSize={backgroundSize}
        />
      );

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const slug = `backgroundimage-${label.replace(/\s+/g, "-")}`;
      const { percentage } = await compareImages(canvasPng, satoriPng, slug);

      expect(percentage).toBeLessThan(1);
    },
  );

  it("renders img with 100vw/100vh — viewport units fill the canvas", async () => {
    const imageDataUri = await makeTestImage(160, 80);
    const element = (
      <img
        src={imageDataUri}
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
        }}
      />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "viewport-units-100vw-100vh",
    );

    expect(percentage).toBeLessThan(1);
  });

  it("renders img with only height set — derives width from intrinsic aspect ratio", async () => {
    const imageDataUri = await makeTestImage(200, 100); // 2:1 landscape
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
        }}
      >
        <img src={imageDataUri} style={{ height: 150, objectFit: "fill" }} />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "img-height-only-intrinsic",
    );
    expect(percentage).toBeLessThan(0.01);
  });

  it("renders img with no dimensions — uses natural image size", async () => {
    const imageDataUri = await makeTestImage(120, 80);
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
        }}
      >
        <img src={imageDataUri} />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "img-no-dimensions-natural-size",
    );
    expect(percentage).toBeLessThan(0.01);
  });

  it("renders img with border — border on image element", async () => {
    const imageDataUri = await makeTestImage(150, 150);

    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "#333",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={imageDataUri}
          style={{
            width: 150,
            height: 150,
            borderRadius: 150,
            border: "3px solid white",
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
      "img-with-border",
    );
    expect(percentage).toBeLessThan(0.1);
  });
});
