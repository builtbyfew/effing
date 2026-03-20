import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../_helpers/canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { layoutText } from "../../jsx/text/index.ts";

describe("layoutText", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("lays out single line text", () => {
    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black" },
      500,
      ctx,
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe("Hello");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("applies text transform uppercase", () => {
    const result = layoutText(
      "hello",
      { fontSize: 16, color: "black", textTransform: "uppercase" },
      500,
      ctx,
    );
    expect(result.segments[0]!.text).toBe("HELLO");
  });

  it("applies text transform lowercase", () => {
    const result = layoutText(
      "HELLO",
      { fontSize: 16, color: "black", textTransform: "lowercase" },
      500,
      ctx,
    );
    expect(result.segments[0]!.text).toBe("hello");
  });

  it("clamps lines with lineClamp and adds ellipsis", () => {
    const longText =
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";
    const unclamped = layoutText(
      longText,
      { fontSize: 16, color: "black" },
      150,
      ctx,
    );
    expect(unclamped.segments.length).toBeGreaterThan(2);

    const clamped = layoutText(
      longText,
      { fontSize: 16, color: "black", lineClamp: 2 },
      150,
      ctx,
    );
    expect(clamped.segments).toHaveLength(2);
    expect(clamped.segments[1]!.text).toContain("\u2026");
    expect(clamped.height).toBeLessThan(unclamped.height);
  });

  it("does not clamp when text fits within lineClamp", () => {
    const result = layoutText(
      "Short",
      { fontSize: 16, color: "black", lineClamp: 3 },
      500,
      ctx,
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe("Short");
  });
});
