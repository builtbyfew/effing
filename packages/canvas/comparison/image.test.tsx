import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { PNG } from "pngjs";
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
  backgroundRepeat?: string;
  // Override the loose file-default 1% for cases where Satori parity should
  // be near-pixel-perfect, so a future regression isn't absorbed by slack.
  threshold?: number;
}[] = [
  { label: "default tiling" },
  { label: "cover", backgroundSize: "cover" },
  { label: "contain", backgroundSize: "contain" },
  { label: "repeat", backgroundRepeat: "repeat", threshold: 0.1 },
  { label: "no-repeat", backgroundRepeat: "no-repeat", threshold: 0.1 },
  { label: "repeat-x", backgroundRepeat: "repeat-x", threshold: 0.1 },
  { label: "repeat-y", backgroundRepeat: "repeat-y", threshold: 0.1 },
  {
    label: "contain + no-repeat",
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    threshold: 0.1,
  },
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

    // Satori renders the blurred box as a browser does, but not the blurred
    // image: it clips after filtering, which keeps the image's edge sharp,
    // where CSS filters the element as painted and so blurs its rounded edge
    // too. The box's half is compared with satori, the image with Chrome.
    const boxHalf = (png: Buffer) => {
      const full = PNG.sync.read(png);
      const half = new PNG({ width: WIDTH / 2, height: HEIGHT });
      for (let y = 0; y < HEIGHT; y++) {
        const row = y * full.width * 4;
        half.data.set(
          full.data.subarray(row, row + half.width * 4),
          y * half.width * 4,
        );
      }
      return PNG.sync.write(half);
    };
    const { percentage } = await compareImages(
      boxHalf(canvasPng),
      boxHalf(satoriPng),
      "blur-showcase",
    );
    expect(percentage).toBeLessThan(1);

    // What Chrome 154 paints for this card across the image's right edge
    // (x = 384), across its top edge (y = 16) and past its bottom right
    // corner: the image fades out over the page instead of ending at its box.
    const chrome: [number, number, number[]][] = [
      [378, 150, [206, 131, 133]],
      [381, 150, [215, 154, 156]],
      [383, 150, [225, 180, 183]],
      [385, 150, [235, 210, 212]],
      [387, 150, [243, 233, 235]],
      [390, 150, [247, 248, 250]],
      [296, 10, [243, 240, 247]],
      [296, 13, [221, 194, 224]],
      [296, 15, [194, 140, 197]],
      [296, 17, [166, 82, 168]],
      [296, 19, [142, 36, 145]],
      [296, 22, [128, 8, 130]],
      [386, 286, [247, 249, 250]],
    ];
    const canvas = PNG.sync.read(canvasPng);
    for (const [x, y, expected] of chrome) {
      const i = (y * canvas.width + x) * 4;
      const actual = Array.from(canvas.data.subarray(i, i + 3));
      const worst = Math.max(
        ...expected.map((value, c) => Math.abs(value - actual[c]!)),
      );
      expect(
        worst,
        `(${x}, ${y}): ${actual} vs Chrome's ${expected}`,
      ).toBeLessThanOrEqual(3);
    }
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
    async ({ label, backgroundSize, backgroundRepeat, threshold }) => {
      const imageDataUri = await makeTestImage(160, 80); // landscape image
      const element = (
        <BackgroundImageCard
          width={WIDTH}
          height={HEIGHT}
          imageDataUri={imageDataUri}
          backgroundSize={backgroundSize}
          backgroundRepeat={backgroundRepeat}
        />
      );

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const slug = `backgroundimage-${label.replace(/\s+/g, "-")}`;
      const { percentage } = await compareImages(canvasPng, satoriPng, slug);

      expect(percentage).toBeLessThan(threshold ?? 1);
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
