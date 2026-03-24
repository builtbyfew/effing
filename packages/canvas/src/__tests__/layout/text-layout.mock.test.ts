import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../_helpers/canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("../../jsx/font.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../jsx/font.ts")>();
  return {
    ...original,
    getFontMetrics: vi.fn(() => null),
  };
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { getFontMetrics } from "../../jsx/font.ts";
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

  it("keeps baseline within line box when hhea metrics shrink auto lineHeight below font content", () => {
    // hhea metrics: ascender=600, descender=-150 → lineHeight=12px
    // Font-derived: ascent=9.6, descent=2.4 → contentHeight=12 (equal)
    // No scaling needed, baselineY = (12 + 9.6 - 2.4) / 2 = 9.6
    vi.mocked(getFontMetrics).mockReturnValue({
      ascender: 600,
      descender: -150,
      unitsPerEm: 1000,
      // (600 + 150) / 1000 * 16 = 12px lineHeight
    });

    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black" }, // line-height: normal (auto)
      500,
      ctx,
    );
    const seg = result.segments[0]!;
    // seg.y is the baseline Y; it must stay within [0, lineHeightPx=12]
    expect(seg.y).toBeGreaterThanOrEqual(0);
    expect(seg.y).toBeLessThanOrEqual(12);

    // totalHeight is ceiled to prevent Yoga rounding from clipping descent
    expect(result.height).toBe(Math.ceil(result.height));

    // Reset mock
    vi.mocked(getFontMetrics).mockReturnValue(null);
  });

  it("ceils totalHeight when descent overflows the line box", () => {
    // hhea metrics: (775 + 194) / 1000 * 16 = 15.504 lineHeightPx
    // Font-derived ascent = 12.4, descent = 3.104 → contentHeight = 15.504
    // baselineY = (15.504 + 12.4 - 3.104) / 2 = 12.4
    // Ceiled to 16 to prevent Yoga rounding from clipping descent.
    vi.mocked(getFontMetrics).mockReturnValue({
      ascender: 775,
      descender: -194,
      unitsPerEm: 1000,
    });

    const result = layoutText("g", { fontSize: 16, color: "black" }, 500, ctx);

    expect(result.height).toBe(16);

    vi.mocked(getFontMetrics).mockReturnValue(null);
  });

  it("does not scale baseline for explicit tight lineHeight", () => {
    // With explicit lineHeight, overflow is intentional — use standard half-leading.
    // Mock canvas: ascent=12, descent=4, contentHeight=16, lineHeight=10.
    // Original formula: baselineY = (10 + 12 - 4) / 2 = 9
    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black", lineHeight: 10 },
      500,
      ctx,
    );
    const seg = result.segments[0]!;
    expect(seg.y).toBe(9);
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
