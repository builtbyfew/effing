import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@effing/skia", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("@effing/skia/extensions", async () => {
  const { createExtensionsMock } = await import("../../canvas-mock.ts");
  return createExtensionsMock();
});

// Emoji SVGs come from a CDN; the tests don't need the network.
vi.mock("../emoji.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../emoji.ts")>()),
  loadEmoji: vi.fn(async () => "<svg></svg>"),
}));

import { createCanvas, loadImage } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";
import { fillParagraph, strokeParagraph } from "@effing/skia/extensions";
import { drawText } from "./text.ts";
import { layoutText } from "../text/index.ts";

describe("drawText", () => {
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
    layout.paragraphOffsetY = offsetY;
    return drawText(ctx, layout, 10, 20, textShadow);
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

  /** The shadow each fillParagraph call casts, and where it draws. */
  const shadowCalls = () => {
    const calls: {
      color: string;
      blur: number;
      offsetX: number;
      offsetY: number;
      shift: number;
    }[] = [];
    vi.mocked(fillParagraph).mockImplementation(() => {
      // setTransform(a, b, c, d, e, f): e is the shift.
      const args = vi.mocked(ctx.setTransform).mock.lastCall as
        unknown[] | undefined;
      const shift = args?.[4];
      calls.push({
        color: String(ctx.shadowColor),
        blur: ctx.shadowBlur,
        offsetX: ctx.shadowOffsetX,
        offsetY: ctx.shadowOffsetY,
        shift: typeof shift === "number" ? shift : 0,
      });
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowColor = "rgba(0, 0, 0, 0)";
      vi.mocked(ctx.setTransform).mockClear();
    });
    return calls;
  };

  it("casts the shadow from text drawn off the canvas", async () => {
    const calls = shadowCalls();
    await draw({}, "3px 4px 4px red");

    expect(fillParagraph).toHaveBeenCalledTimes(2);
    const [shadow, text] = calls;
    // The text is shifted off the canvas, and its shadow back by as much.
    expect(shadow!.shift).toBeGreaterThan(200);
    expect(shadow).toMatchObject({ color: "red", blur: 4, offsetY: 4 });
    expect(shadow!.offsetX).toBe(3 - shadow!.shift);
    expect(text).toMatchObject({ blur: 0, offsetX: 0, shift: 0 });
  });

  it("draws a list of shadows back to front, before the text", async () => {
    const calls = shadowCalls();
    await draw({}, "1px 2px red, blue 3px 4px");

    expect(fillParagraph).toHaveBeenCalledTimes(3);
    expect(calls.map((c) => [c.color, c.offsetX + c.shift, c.offsetY])).toEqual(
      [
        ["blue", 3, 4],
        ["red", 1, 2],
        ["rgba(0, 0, 0, 0)", 0, 0],
      ],
    );
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

  it("draws an emoji image in its box, over the text", async () => {
    const layout = layoutText(
      "aa \u{1F30D}",
      { fontSize: 16, lineHeight: 20 },
      500,
      true,
    );
    const emoji = layout.emoji[0]!;
    // Loaded once per emoji style and grapheme, so this one is unique here.
    await drawText(ctx, layout, 10, 20, undefined, "twemoji");

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      10 + emoji.x,
      20 + emoji.y,
      16,
      16,
    );
    expect(vi.mocked(fillParagraph).mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(ctx.drawImage).mock.invocationCallOrder[0]!,
    );
  });

  it("draws an emoji as text on its baseline when its image is missing", async () => {
    vi.mocked(loadImage).mockRejectedValueOnce(new Error("offline"));
    const layout = layoutText(
      "aa \u{1F389}",
      { fontSize: 16, lineHeight: 20 },
      500,
      true,
    );
    await drawText(ctx, layout, 10, 20, undefined, "twemoji");

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith("\u{1F389}", 10 + 24, 20 + 14);
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
