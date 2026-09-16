import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import {
  HAS_NATIVE_DEPS,
  loadFonts,
  renderWithCanvas,
} from "./_helpers/setup.ts";

const WIDTH = 400;
const HEIGHT = 200;

function pixel(png: PNG, x: number, y: number): [number, number, number] {
  const i = (y * png.width + x) * 4;
  return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
}

/** True for pixels that are (nearly) pure black or pure white. */
function isCrisp([r, g, b]: [number, number, number]): boolean {
  const v = (r + g + b) / 3;
  return v < 15 || v > 240;
}

/** True for mid greys — what blurring 4px black/white stripes produces. */
function isBlurred([r, g, b]: [number, number, number]): boolean {
  const v = (r + g + b) / 3;
  return v > 70 && v < 185;
}

/** A frame of 4px vertical black/white stripes with `children` on top. */
function stripes(children: React.ReactNode) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: WIDTH,
        height: HEIGHT,
        background: "white",
      }}
    >
      {Array.from({ length: WIDTH / 8 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: i * 8,
            top: 0,
            width: 4,
            height: HEIGHT,
            background: "black",
          }}
        />
      ))}
      {children}
    </div>
  );
}

async function render(element: React.ReactNode, fonts: FontData[]) {
  return PNG.sync.read(await renderWithCanvas(element, WIDTH, HEIGHT, fonts));
}

describe.skipIf(!HAS_NATIVE_DEPS)("backdrop-filter rendering", () => {
  let fonts: FontData[];
  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it("blurs only the backdrop behind the element's box", async () => {
    const png = await render(
      stripes(
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 200,
            height: 100,
            backdropFilter: "blur(6px)",
          }}
        />,
      ),
      fonts,
    );
    // Sanity: the stripes themselves are crisp.
    expect(isCrisp(pixel(png, 50, 100))).toBe(true);
    expect(isCrisp(pixel(png, 200, 20))).toBe(true);
    expect(isCrisp(pixel(png, 350, 180))).toBe(true);
    // Inside the element the stripes are smeared to grey.
    expect(isBlurred(pixel(png, 200, 100))).toBe(true);
    expect(isBlurred(pixel(png, 110, 60))).toBe(true);
    expect(isBlurred(pixel(png, 290, 140))).toBe(true);
    // Just outside the box edge nothing changed.
    expect(isCrisp(pixel(png, 96, 100))).toBe(true);
    expect(isCrisp(pixel(png, 200, 46))).toBe(true);
  });

  it("respects the border radius", async () => {
    const png = await render(
      stripes(
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 200,
            height: 100,
            borderRadius: 50,
            backdropFilter: "blur(6px)",
          }}
        />,
      ),
      fonts,
    );
    expect(isBlurred(pixel(png, 200, 100))).toBe(true);
    // The box corners lie outside the rounded shape.
    expect(isCrisp(pixel(png, 104, 54))).toBe(true);
    expect(isCrisp(pixel(png, 296, 146))).toBe(true);
  });

  it("composites the element's own background over the filtered backdrop", async () => {
    const png = await render(
      stripes(
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 200,
            height: 100,
            backdropFilter: "blur(6px)",
            backgroundColor: "rgba(255, 0, 0, 0.5)",
          }}
        />,
      ),
      fonts,
    );
    const [r, g, b] = pixel(png, 200, 100);
    // Red tint over grey: red channel well above green/blue, neither extreme.
    expect(r - g).toBeGreaterThan(60);
    expect(g).toBeGreaterThan(30);
    expect(g).toBeLessThan(120);
    expect(Math.abs(g - b)).toBeLessThan(10);
  });

  it("applies non-blur filters", async () => {
    const png = await render(
      <div
        style={{
          display: "flex",
          position: "relative",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 200,
            height: 100,
            backdropFilter: "brightness(0.5)",
          }}
        />
      </div>,
      fonts,
    );
    const [inside] = pixel(png, 200, 100);
    const [outside] = pixel(png, 50, 100);
    expect(outside).toBe(255);
    expect(inside).toBeGreaterThan(115);
    expect(inside).toBeLessThan(140);
  });

  it("sees the full backdrop under a scale transform", async () => {
    // The scaled container's box maps to x 50..350, y 25..175 on the canvas.
    const png = await render(
      stripes(
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 100,
            top: 50,
            width: 200,
            height: 100,
            transform: "scale(1.5)",
          }}
        >
          <div
            style={{ width: 200, height: 100, backdropFilter: "blur(4px)" }}
          />
        </div>,
      ),
      fonts,
    );
    expect(isBlurred(pixel(png, 200, 100))).toBe(true);
    expect(isBlurred(pixel(png, 60, 100))).toBe(true); // only inside the scaled box
    expect(isCrisp(pixel(png, 20, 100))).toBe(true);
    expect(isCrisp(pixel(png, 200, 10))).toBe(true);
  });

  it("keeps working under rotation", async () => {
    const png = await render(
      stripes(
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 50,
            width: 100,
            height: 100,
            transform: "rotate(45deg)",
            backdropFilter: "blur(6px)",
          }}
        />,
      ),
      fonts,
    );
    // Centre of the rotated square is blurred; its former corner (now outside
    // the diamond) is not.
    expect(isBlurred(pixel(png, 200, 100))).toBe(true);
    expect(isCrisp(pixel(png, 154, 54))).toBe(true);
  });

  it("keeps the blur uniform up to the canvas edge", async () => {
    // A full-width bar flush with the bottom edge: the blur must not fade out
    // along the left, right and bottom edges where the snapshot leaves the
    // canvas.
    const png = await render(
      stripes(
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 140,
            width: WIDTH,
            height: 60,
            backdropFilter: "blur(10px)",
          }}
        />,
      ),
      fonts,
    );
    const value = (x: number, y: number) => {
      const [r, g, b] = pixel(png, x, y);
      return (r + g + b) / 3;
    };
    // Largest pixel-to-pixel step along a row segment: a lost blur brings the
    // 4px stripes back as steps of 25+ per pixel, a uniform blur leaves at
    // most the gentle drift toward the clamped boundary colour.
    const maxStep = (x0: number, x1: number, y: number) => {
      let step = 0;
      for (let x = x0; x < x1; x++) {
        step = Math.max(step, Math.abs(value(x + 1, y) - value(x, y)));
      }
      return step;
    };
    expect(isBlurred(pixel(png, 200, 170))).toBe(true);
    expect(isBlurred(pixel(png, 200, 198))).toBe(true);
    expect(maxStep(0, 12, 170)).toBeLessThan(8);
    expect(maxStep(387, 399, 170)).toBeLessThan(8);
    expect(maxStep(190, 210, 198)).toBeLessThan(8);
    expect(maxStep(0, 12, 198)).toBeLessThan(8);
    expect(isCrisp(pixel(png, 2, 170))).toBe(false);
    expect(isCrisp(pixel(png, 2, 198))).toBe(false);
  });

  it("keeps the filter isotropic in element space under a non-uniform scale", async () => {
    // Horizontal 4px stripes behind an element scaled 4× horizontally and
    // 0.25× vertically (device box x 0..400, y 75..125). blur(4px) is 4 CSS
    // px of the element, so only 1 device px vertically: the stripes stay
    // clearly visible. A filter applied at the transform's average scale (1)
    // would smear them to flat grey.
    const png = await render(
      <div
        style={{
          display: "flex",
          position: "relative",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
        }}
      >
        {Array.from({ length: HEIGHT / 8 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: i * 8,
              width: WIDTH,
              height: 4,
              background: "black",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 0,
            width: 100,
            height: 200,
            transform: "scale(4, 0.25)",
            backdropFilter: "blur(4px)",
          }}
        />
      </div>,
      fonts,
    );
    const value = (x: number, y: number) => {
      const [r, g, b] = pixel(png, x, y);
      return (r + g + b) / 3;
    };
    // Rows 96..100 are a black stripe, 100..104 a white one.
    expect(value(200, 98)).toBeLessThan(90);
    expect(value(200, 102)).toBeGreaterThan(165);
    expect(value(50, 98)).toBeLessThan(90);
    expect(value(350, 102)).toBeGreaterThan(165);
    // Outside the element the stripes are untouched.
    expect(isCrisp(pixel(png, 200, 30))).toBe(true);
  });

  it("leaves the element's own box-shadow out of the backdrop", async () => {
    // On a white page the only dark pixels come from the element's shadow. It
    // must not be blurred inward: the interior stays white right up to the
    // edge, as in a browser.
    const png = await render(
      <div
        style={{
          display: "flex",
          position: "relative",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 50,
            width: 200,
            height: 100,
            boxShadow: "0 0 20px black",
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(255, 255, 255, 0.25)",
          }}
        />
      </div>,
      fonts,
    );
    for (const [x, y] of [
      [102, 100],
      [200, 52],
      [298, 100],
      [200, 148],
    ] as const) {
      const [r, g, b] = pixel(png, x, y);
      expect(Math.min(r, g, b), `pixel ${x},${y}`).toBeGreaterThanOrEqual(250);
    }
    // The shadow itself is still painted outside the box.
    const [outside] = pixel(png, 96, 100);
    expect(outside).toBeLessThan(240);
  });
});
