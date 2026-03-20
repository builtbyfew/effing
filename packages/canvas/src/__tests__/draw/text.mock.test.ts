import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../_helpers/canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawText } from "../../jsx/draw/text.ts";
import type { TextSegment } from "../../jsx/text/index.ts";

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
    vi.clearAllMocks();
  });

  it("applies shadow when offsets use unitless zero", async () => {
    await drawText(ctx, [makeSegment()], 0, 0, "0 1px 2px rgba(0, 0, 0, 0.25)");

    expect(ctx.shadowOffsetX).toBe(0);
    expect(ctx.shadowOffsetY).toBe(1);
    expect(ctx.shadowBlur).toBe(2);
    expect(ctx.shadowColor).toBe("rgba(0, 0, 0, 0.25)");
  });

  it("applies shadow when all offsets have px units", async () => {
    await drawText(ctx, [makeSegment()], 0, 0, "3px 4px 5px red");

    expect(ctx.shadowOffsetX).toBe(3);
    expect(ctx.shadowOffsetY).toBe(4);
    expect(ctx.shadowBlur).toBe(5);
    expect(ctx.shadowColor).toBe("red");
  });

  it("applies shadow with mixed units and unitless values", async () => {
    await drawText(ctx, [makeSegment()], 0, 0, "0 0 4px rgba(0,0,0,0.5)");

    expect(ctx.shadowOffsetX).toBe(0);
    expect(ctx.shadowOffsetY).toBe(0);
    expect(ctx.shadowBlur).toBe(4);
    expect(ctx.shadowColor).toBe("rgba(0,0,0,0.5)");
  });
});
