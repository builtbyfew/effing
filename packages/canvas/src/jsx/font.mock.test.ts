import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { FontData } from "../types.ts";
import { _resetForTest, registerFont } from "./font.ts";
import { setFont } from "./text/measure.ts";

function font(
  weight: FontData["weight"],
  style: FontData["style"] = "normal",
): FontData {
  return {
    name: "Test Family",
    weight,
    style,
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
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn when every face is registered before the first lookup", () => {
    registerFont(font(400));
    registerFont(font(700));
    registerFont(font(400, "italic"));
    setFont(ctx, 16, "Test Family", 400);
    setFont(ctx, 16, "Test Family", "bold");
    setFont(ctx, 16, "Test Family, sans-serif", 400, "italic");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once when layout requests a weight the family has no face for", () => {
    registerFont(font(700));
    setFont(ctx, 16, "Test Family", 400);
    setFont(ctx, 20, "Test Family", 400);
    setFont(ctx, 16, "Test Family, sans-serif", 400);

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0]![0] as string;
    expect(message).toContain(
      'No face registered for "Test Family" 400 normal',
    );
    expect(message).toContain("registered: 700 normal");
  });

  it("does not warn about families it knows nothing about", () => {
    setFont(ctx, 16, "Helvetica, Arial, sans-serif", 700);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when a face is registered after its family/weight/style was looked up", () => {
    setFont(ctx, 16, '"Test Family", sans-serif', 400);
    expect(warn).not.toHaveBeenCalled();

    registerFont(font(400));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain(
      '"Test Family" 400 normal was registered after',
    );

    // A face nobody has asked for yet is fine.
    registerFont(font(700));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
