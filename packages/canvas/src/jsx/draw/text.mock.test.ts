import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@effing/skia", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("@effing/skia/extensions", async () => {
  const { createExtensionsMock } = await import("../../canvas-mock.ts");
  return createExtensionsMock();
});

import { createCanvas } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";
import { fillParagraph, strokeParagraph } from "@effing/skia/extensions";
import { drawText } from "./text.ts";
import { layoutText } from "../text/index.ts";
import type { TextSegment } from "../text/index.ts";

function makeSegment(overrides?: Partial<TextSegment>): TextSegment {
  return {
    text: "Hello",
    x: 0,
    y: 20,
    width: 40,
    height: 16,
    fontSize: 16,
    fontFamily: "sans-serif",
    fontWeight: 400,
    fontStyle: "normal",
    color: "black",
    ascent: 12,
    letterSpacing: 0,
    lineIndex: 0,
    ...overrides,
  };
}

describe("drawText — textShadow", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    // Reset properties that leak between tests (mock restore() is a no-op)
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    vi.clearAllMocks();
  });

  it("draws shadow as separate fillText with shadow color", async () => {
    await drawText(ctx, [makeSegment()], 0, 0, "3px 4px 0 red");

    // Shadow pass + main text pass = 2 fillText calls
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    // Shadow pass uses shadow color as fillStyle and translate for offset
    expect(ctx.translate).toHaveBeenCalledWith(3, 4);
  });

  it("applies blur filter for shadow with blur radius", async () => {
    await drawText(ctx, [makeSegment()], 0, 0, "0 0 4px rgba(0,0,0,0.5)");

    expect(ctx.filter).toBe("blur(2px)");
  });

  it("scales shadow opacity by text alpha for alpha colors", async () => {
    // rgba(255,255,255,0.5) → text alpha 0.5
    await drawText(
      ctx,
      [makeSegment({ color: "rgba(255, 255, 255, 0.5)" })],
      0,
      0,
      "2px 2px 0 red",
    );

    // globalAlpha should be multiplied by text alpha during shadow pass
    expect(ctx.globalAlpha).toBe(0.5);
  });

  it("does not scale shadow opacity for opaque text", async () => {
    await drawText(
      ctx,
      [makeSegment({ color: "black" })],
      0,
      0,
      "2px 2px 0 red",
    );

    // globalAlpha should remain 1 for opaque text
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe("drawText — fillText call count", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("draws text exactly once without shadow", async () => {
    await drawText(ctx, [makeSegment()], 0, 0);

    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it("draws shadow + text (2 fillText calls) with shadow", async () => {
    await drawText(ctx, [makeSegment()], 0, 0, "0 1px 2px rgba(0, 0, 0, 0.25)");

    // 1 shadow fillText + 1 main fillText
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("draws shadow + text + stroke with shadow + stroke", async () => {
    await drawText(
      ctx,
      [makeSegment({ textStrokeWidth: 2, textStrokeColor: "red" })],
      0,
      0,
      "0 1px 2px rgba(0, 0, 0, 0.25)",
    );

    // 1 shadow fillText + 1 main fillText
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    expect(ctx.strokeText).toHaveBeenCalledTimes(1);
  });

  it("draws shadow + text with letterSpacing", async () => {
    await drawText(
      ctx,
      [makeSegment({ text: "AB", letterSpacing: 2 })],
      0,
      0,
      "0 1px 2px rgba(0, 0, 0, 0.25)",
    );

    // 2 chars × shadow pass + 2 chars × main pass = 4
    expect(ctx.fillText).toHaveBeenCalledTimes(4);
  });
});

describe("drawText — native paragraph", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    vi.clearAllMocks();
  });

  // Two lines of mock text: "aaa bbb" and "ccc".
  const draw = (
    style: Parameters<typeof layoutText>[1],
    textShadow?: string,
    offsetY = 0,
  ) => {
    const layout = layoutText("aaa bbb ccc", { fontSize: 16, ...style }, 56);
    return drawText(ctx, layout.segments, 10, 20, textShadow, undefined, {
      paragraph: layout.paragraph!,
      offsetY,
    });
  };

  it("fills the whole paragraph in one call", async () => {
    await draw({ color: "red" });

    expect(fillParagraph).toHaveBeenCalledTimes(1);
    expect(fillParagraph).toHaveBeenCalledWith(ctx, expect.anything(), 10, 20);
    expect(ctx.fillStyle).toBe("red");
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("paints the paragraph at its offset in the text block", async () => {
    await draw({}, undefined, -8);

    expect(fillParagraph).toHaveBeenCalledWith(ctx, expect.anything(), 10, 12);
  });

  it("draws the shadow as a separate fill, offset and blurred", async () => {
    await draw({}, "3px 4px 4px red");

    expect(fillParagraph).toHaveBeenCalledTimes(2);
    expect(ctx.translate).toHaveBeenCalledWith(3, 4);
    expect(ctx.filter).toBe("blur(2px)");
  });

  it("strokes the paragraph under the fill", async () => {
    await draw({ WebkitTextStrokeWidth: 2, WebkitTextStrokeColor: "blue" });

    expect(strokeParagraph).toHaveBeenCalledTimes(1);
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.strokeStyle).toBe("blue");
    expect(
      vi.mocked(strokeParagraph).mock.invocationCallOrder[0]!,
    ).toBeLessThan(vi.mocked(fillParagraph).mock.invocationCallOrder[0]!);
  });

  it("decorates each line of the paragraph", async () => {
    await draw({ textDecoration: "underline" });

    // One underline per line, as wide as the line's text.
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(vi.mocked(ctx.lineTo).mock.calls.map((c) => c[0])).toEqual([
      10 + 56,
      10 + 24,
    ]);
  });
});
