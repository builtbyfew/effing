import { describe, expect, it } from "vitest";
import { createCanvas } from "@effing/skia";
import { setFont } from "./measure.ts";

describe("setFont", () => {
  it("sets a font that ctx.font accepts for any weight and style", () => {
    const ctx = createCanvas(1, 1).getContext("2d");
    // ctx.font ignores a value it can't parse and keeps the last font, so
    // each of these must replace the 99px font set before it (ctx.font
    // leaves out the weight when it is 400).
    for (const [weight, style, expected] of [
      [0, "normal", "1"],
      [1001, "normal", "1000"],
      [Number.NaN, "normal", "12px"],
      ["heavy", "normal", "12px"],
      ["bold", "slanted", "bold 12px"],
      ["550", "italic", "550"],
    ] as const) {
      ctx.font = "99px serif";
      setFont(ctx, 12, "Inter", weight, style);
      expect(ctx.font, `${weight} ${style}`).toContain("12px");
      expect(ctx.font, `${weight} ${style}`).toContain(expected);
    }
  });
});
