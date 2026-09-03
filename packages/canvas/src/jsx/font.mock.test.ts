import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { FontData } from "../types.ts";
import { _resetForTest, registerFont, registerFontFromPath } from "./font.ts";
import { setFont } from "./text/measure.ts";

const GENERATION_FAMILY = /"effing-font-generation-\d+"$/;

function font(weight: FontData["weight"]): FontData {
  return {
    name: "Test Family",
    weight,
    style: "normal",
    data: Buffer.from("not a font"),
  };
}

describe("registerFont", () => {
  let ctx: SKRSContext2D;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetForTest();
    vi.mocked(GlobalFonts.register).mockClear();
    ctx = createCanvas(1, 1).getContext("2d");
    vi.mocked(ctx.measureText).mockReset();
    vi.mocked(ctx.measureText).mockImplementation(
      (text: string) =>
        ({
          width: text.length * 8,
          fontBoundingBoxAscent: 12,
          fontBoundingBoxDescent: 4,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4,
        }) as TextMetrics,
    );
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("registers each family/weight/style once", () => {
    registerFont(font(400));
    registerFont(font(400));
    registerFont(font(700));
    expect(GlobalFonts.register).toHaveBeenCalledTimes(2);
    expect(GlobalFonts.register).toHaveBeenCalledWith(
      expect.any(Buffer),
      "Test Family",
    );
  });

  it("appends a generation family to every font string set by setFont", () => {
    setFont(ctx, 16, "Inter, sans-serif", 700, "italic");
    expect(ctx.font).toMatch(
      /^italic 700 16px "Inter", sans-serif, "effing-font-generation-\d+"$/,
    );
  });

  it("changes the lookup key after every registration, but not for no-op re-registrations", () => {
    setFont(ctx, 16, "Inter", 400, "normal");
    const before = ctx.font;
    expect(before).toMatch(GENERATION_FAMILY);

    registerFont(font(400));
    setFont(ctx, 16, "Inter", 400, "normal");
    const afterFirst = ctx.font;
    expect(afterFirst).not.toBe(before);

    registerFont(font(400));
    setFont(ctx, 16, "Inter", 400, "normal");
    expect(ctx.font).toBe(afterFirst);

    registerFontFromPath("/fonts/Inter-Bold.ttf", "Inter");
    setFont(ctx, 16, "Inter", 400, "normal");
    expect(ctx.font).not.toBe(afterFirst);
  });

  it("warns when the bare family lookup resolves differently from a fresh one", () => {
    // Simulate a bare key that was pinned to another face before this
    // registration: only lookups carrying the generation family see the
    // newly registered face.
    vi.mocked(ctx.measureText).mockImplementation(
      (text: string) =>
        ({
          width: GENERATION_FAMILY.test(ctx.font)
            ? text.length * 8
            : text.length * 9,
          fontBoundingBoxAscent: 12,
          fontBoundingBoxDescent: 4,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4,
        }) as TextMetrics,
    );

    registerFont(font(400));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('"Test Family" 400 normal');
    expect(warn.mock.calls[0]![0]).toContain("Register every face of a family");
  });

  it("does not warn when the bare and fresh lookups agree", () => {
    registerFont(font(400));
    registerFont(font(700));
    expect(warn).not.toHaveBeenCalled();
  });
});
