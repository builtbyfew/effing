import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "./index.ts";

function svgNode(
  gradient: Record<string, unknown>,
  shape: Record<string, unknown>,
  paintProp: "fill" | "stroke" = "fill",
) {
  return {
    type: "svg",
    style: {},
    children: [],
    props: {
      viewBox: "0 0 200 100",
      children: [
        {
          type: "defs",
          props: {
            children: { type: gradient.type, props: gradient.props },
          },
        },
        {
          type: "rect",
          props: { ...shape, [paintProp]: "url(#g)" },
        },
      ],
    },
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  };
}

const stops = [
  { type: "stop", props: { offset: 0, stopColor: "#ff0000" } },
  { type: "stop", props: { offset: 1, stopColor: "#0000ff" } },
];

describe("SVG gradients — gradientUnits handling", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("maps objectBoundingBox (default) fractions to the shape bbox", async () => {
    await drawNode(
      ctx,
      svgNode(
        {
          type: "linearGradient",
          props: { id: "g", x1: 0, y1: 0, x2: 1, y2: 0, children: stops },
        },
        { x: 50, y: 10, width: 100, height: 50 },
      ),
      0,
      0,
    );

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(50, 10, 150, 10);
  });

  it("uses userSpaceOnUse coordinates directly, not as bbox fractions", async () => {
    await drawNode(
      ctx,
      svgNode(
        {
          type: "linearGradient",
          props: {
            id: "g",
            gradientUnits: "userSpaceOnUse",
            x1: 0,
            y1: 0,
            x2: 200,
            y2: 0,
            children: stops,
          },
        },
        { x: 50, y: 10, width: 100, height: 50 },
      ),
      0,
      0,
    );

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 200, 0);
    const gradient = vi.mocked(ctx.createLinearGradient).mock.results[0]
      ?.value as { addColorStop: ReturnType<typeof vi.fn> };
    expect(gradient.addColorStop).toHaveBeenCalledWith(0, "#ff0000");
    expect(gradient.addColorStop).toHaveBeenCalledWith(1, "#0000ff");
  });

  it("resolves userSpaceOnUse percentages against the viewport", async () => {
    await drawNode(
      ctx,
      svgNode(
        {
          type: "linearGradient",
          props: {
            id: "g",
            gradientUnits: "userSpaceOnUse",
            x1: "0%",
            y1: "50%",
            x2: "100%",
            y2: "50%",
            children: stops,
          },
        },
        { x: 50, y: 10, width: 100, height: 50 },
      ),
      0,
      0,
    );

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 50, 200, 50);
  });

  it("defaults userSpaceOnUse x2 to 100% of the viewport width", async () => {
    await drawNode(
      ctx,
      svgNode(
        {
          type: "linearGradient",
          props: {
            id: "g",
            gradientUnits: "userSpaceOnUse",
            children: stops,
          },
        },
        { x: 50, y: 10, width: 100, height: 50 },
      ),
      0,
      0,
    );

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 200, 0);
  });

  it("creates a circular radial gradient in user space without the bbox transform", async () => {
    await drawNode(
      ctx,
      svgNode(
        {
          type: "radialGradient",
          props: {
            id: "g",
            gradientUnits: "userSpaceOnUse",
            cx: 100,
            cy: 50,
            r: 60,
            children: stops,
          },
        },
        { x: 50, y: 10, width: 100, height: 50 },
      ),
      0,
      0,
    );

    expect(ctx.createRadialGradient).toHaveBeenCalledWith(
      100,
      50,
      0,
      100,
      50,
      60,
    );
  });

  it("uses userSpaceOnUse coordinates directly for strokes", async () => {
    await drawNode(
      ctx,
      svgNode(
        {
          type: "linearGradient",
          props: {
            id: "g",
            gradientUnits: "userSpaceOnUse",
            x1: 0,
            y1: 0,
            x2: 200,
            y2: 0,
            children: stops,
          },
        },
        { x: 50, y: 10, width: 100, height: 50, fill: "none" },
        "stroke",
      ),
      0,
      0,
    );

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 200, 0);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
