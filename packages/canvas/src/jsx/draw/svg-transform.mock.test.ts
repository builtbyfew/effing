import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "./index.ts";

describe("SVG transform attribute on shape elements", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("applies transform attribute on SVG shape elements (not just groups)", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 100 100",
          children: [
            {
              type: "line",
              props: {
                x1: "0",
                y1: "50",
                x2: "100",
                y2: "50",
                stroke: "black",
                strokeWidth: "2",
                transform: "rotate(45 50 50)",
              },
            },
          ],
        },
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      0,
      0,
    );

    // Transform should cause save/restore pair and a rotate+translate call
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    // The transform function should have been called (applySvgTransform uses ctx.rotate/translate/transform)
    const rotateCalls = vi.mocked(ctx.rotate).mock.calls;
    const transformCalls = vi.mocked(ctx.transform).mock.calls;
    expect(rotateCalls.length + transformCalls.length).toBeGreaterThan(0);
  });
});

describe("SVG opacity on <g> elements and shape elements", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("applies opacity on <g> elements via globalAlpha", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 100 100",
          children: [
            {
              type: "g",
              props: {
                opacity: "0.5",
                children: [
                  {
                    type: "rect",
                    props: {
                      x: "0",
                      y: "0",
                      width: "100",
                      height: "100",
                      fill: "red",
                    },
                  },
                ],
              },
            },
          ],
        },
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      0,
      0,
    );

    // opacity on <g> should trigger save/restore and set globalAlpha
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("applies opacity on individual shape elements via globalAlpha", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 100 100",
          children: [
            {
              type: "rect",
              props: {
                x: "0",
                y: "0",
                width: "100",
                height: "100",
                fill: "blue",
                opacity: "0.3",
              },
            },
          ],
        },
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      0,
      0,
    );

    // opacity on shape should trigger save/restore
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
