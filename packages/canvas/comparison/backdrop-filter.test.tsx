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
});
