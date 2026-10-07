import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import { loadFonts, renderWithCanvas } from "./_helpers/setup.ts";

// An element's opacity and filter apply to it and its descendants as one
// compositing group, as in CSS, rather than to each draw. Every case here
// comes out differently when they are applied per draw.
describe("compositing groups", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  const render = async (element: React.ReactElement) =>
    PNG.sync.read(await renderWithCanvas(element, 300, 200, fonts));

  const pixel = (img: PNG, x: number, y: number) =>
    Array.from(
      img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4),
    );

  const box = (left: number, top: number, background: string) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: 100,
        height: 100,
        background,
      }}
    />
  );

  it("fades overlapping children as one group under opacity", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.5,
          }}
        >
          {box(20, 20, "#2563eb")}
          {box(70, 60, "#2563eb")}
        </div>
      </div>,
    );
    // Inside the overlap, and inside only the first box.
    expect(pixel(img, 90, 90)).toEqual(pixel(img, 30, 30));
  });

  it("multiplies the opacity of nested groups", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.5,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 20,
              width: 100,
              height: 100,
              background: "#000",
              opacity: 0.5,
            }}
          />
        </div>
      </div>,
    );
    // Black at 0.5 × 0.5 over white: 255 × 0.75.
    const [r, g, b] = pixel(img, 60, 60);
    for (const channel of [r, g, b]) {
      expect(Math.abs(channel! - 191)).toBeLessThanOrEqual(1);
    }
  });

  it("casts one drop-shadow for the whole group", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            filter: "drop-shadow(-10px 10px 0px #f00)",
          }}
        >
          {box(20, 20, "#fff")}
          {box(70, 20, "#fff")}
        </div>
      </div>,
    );
    // The second box's shadow falls on the visible strip of the first box
    // (x 60–70): per draw, it's painted over that box; as a group, the
    // union casts one shadow behind both.
    expect(pixel(img, 65, 60)).toEqual([255, 255, 255, 255]);
    // The group's shadow itself, below the boxes.
    expect(pixel(img, 100, 125)).toEqual([255, 0, 0, 255]);
  });

  it("scales a filter with the element's transform", async () => {
    // A hard 4px shadow under scale(2) falls 8 device pixels below the box.
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 50,
            height: 40,
            background: "#fff",
            filter: "drop-shadow(0px 4px 0px #f00)",
            transform: "scale(2)",
            transformOrigin: "left top",
          }}
        />
      </div>,
    );
    // The box spans y 50–130; its shadow shows from 130 to 138.
    expect(pixel(img, 150, 134)).toEqual([255, 0, 0, 255]);
    expect(pixel(img, 150, 142)).toEqual([255, 255, 255, 255]);
  });

  // Fading an element must give the same picture as rendering it on its own
  // and compositing that at the opacity, which is what a group is. `scene`
  // draws the element over the given page background at the given opacity.
  const expectFadesAsOne = async (
    scene: (
      background: string | undefined,
      opacity: number,
    ) => React.ReactElement,
    minPainted: number,
  ) => {
    const [actual, alone] = await Promise.all([
      render(scene("#fff", 0.5)),
      render(scene(undefined, 1)),
    ]);
    // Opacity is quantized to 8 bits, as globalAlpha is.
    const alpha = Math.round(0.5 * 255) / 255;
    let painted = 0;
    let worst = 0;
    for (let i = 0; i < actual.data.length; i += 4) {
      const coverage = (alone.data[i + 3]! / 255) * alpha;
      if (coverage > 0) painted++;
      for (let c = 0; c < 3; c++) {
        const expected = 255 + (alone.data[i + c]! - 255) * coverage;
        worst = Math.max(worst, Math.abs(actual.data[i + c]! - expected));
      }
    }
    expect(painted).toBeGreaterThan(minPainted);
    expect(worst).toBeLessThanOrEqual(2);
  };

  const page = (background: string | undefined, child: React.ReactNode) => (
    <div
      style={{
        width: 300,
        height: 200,
        display: "flex",
        background,
        fontFamily: "Liberation Sans",
      }}
    >
      {child}
    </div>
  );

  it("keeps everything a translucent element paints, shadow and edges included", async () => {
    // A group's buffer is sized to what the group draws. Nothing of the
    // box-shadow outside the element's clip or of the anti-aliased edges may
    // be cut, also under a rotation and a scale.
    await expectFadesAsOne(
      (background, opacity) =>
        page(
          background,
          <div
            style={{
              position: "absolute",
              left: 80.3,
              top: 50.7,
              width: 120,
              height: 70,
              display: "flex",
              borderRadius: 16,
              overflow: "hidden",
              background: "#f97316",
              boxShadow: "6px 8px 10px #000",
              transform: "rotate(8deg) scale(1.2)",
              opacity,
            }}
          >
            {box(70, 20, "#2563eb")}
          </div>,
        ),
      15_000,
    );
  });

  // Glyphs that overlap, within a line or between lines, fade as one too.
  it.each([
    ["one line of text", { fontSize: 44 }, "Fading words"],
    [
      "wrapped text",
      { fontSize: 26, width: 220 },
      "Words that wrap onto a second and a third line of text",
    ],
    [
      "letter-spaced text whose glyphs overlap",
      { fontSize: 44, letterSpacing: -6 },
      "Tight words",
    ],
  ])("fades %s as one", async (_, style, words) => {
    await expectFadesAsOne(
      (background, opacity) =>
        page(
          background,
          <div
            style={{
              position: "absolute",
              left: 20.4,
              top: 30.6,
              color: "#1d4ed8",
              opacity,
              ...style,
            }}
          >
            {words}
          </div>,
        ),
      1_500,
    );
  });

  it("fades text and the background behind it as one", async () => {
    await expectFadesAsOne(
      (background, opacity) =>
        page(
          background,
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 30,
              padding: 12,
              fontSize: 40,
              color: "#000",
              background: "#f97316",
              opacity,
            }}
          >
            Label
          </div>,
        ),
      5_000,
    );
  });

  // @effing/skia flushes its deferred recording once it holds 32 MiB, decoded
  // images included. A flush in the middle of a group would composite it in
  // two parts, and what the group paints after a large image would no longer
  // hide it (1.0.10-effing.1 did that); the flush has to wait for the group.
  it("keeps a group whole when it holds an image past the recording cap", async () => {
    // 4000×3000 decodes to 45.8 MiB.
    const { createCanvas } = await import("@effing/skia");
    const photo = createCanvas(4000, 3000);
    const photoCtx = photo.getContext("2d");
    photoCtx.fillStyle = "#f97316";
    photoCtx.fillRect(0, 0, 4000, 3000);
    const src = `data:image/png;base64,${photo.toBuffer("image/png").toString("base64")}`;

    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.5,
          }}
        >
          <img
            src={src}
            width={200}
            height={150}
            style={{ position: "absolute", left: 20, top: 20 }}
          />
          {box(100, 60, "#000")}
        </div>
      </div>,
    );
    // The black box covers the image, so inside it the group is black and
    // fades to mid-grey over the white canvas. Split in two, the image
    // shows through the box as an orange tint.
    for (const channel of pixel(img, 150, 100).slice(0, 3)) {
      expect(Math.abs(channel - 127)).toBeLessThanOrEqual(2);
    }
  });

  it("reads a backdrop only from within its backdrop root", async () => {
    const img = await render(
      <div
        style={{
          width: 300,
          height: 200,
          display: "flex",
          background: "#000",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 300,
            height: 200,
            display: "flex",
            opacity: 0.9,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 50,
              top: 50,
              width: 100,
              height: 100,
              backdropFilter: "invert(1)",
            }}
          />
        </div>
      </div>,
    );
    // The black canvas is behind the opacity group, not in it, so there is
    // nothing to invert: CSS leaves it black, where filtering the canvas
    // would turn it white.
    expect(pixel(img, 100, 100).slice(0, 3)).toEqual([0, 0, 0]);
  });
});
