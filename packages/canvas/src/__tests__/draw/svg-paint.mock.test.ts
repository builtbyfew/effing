import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../_helpers/canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "../../jsx/draw/index.ts";

describe("SVG paint — fill, stroke, currentColor", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("applies SVG fill from style prop (higher specificity)", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "path",
            props: {
              d: "M0 0L10 10",
              style: { fill: "blue" },
            },
          },
        },
        x: 0,
        y: 0,
        width: 24,
        height: 24,
      },
      0,
      0,
      false,
    );

    expect(ctx.fillStyle).toBe("blue");
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("style fill overrides direct fill prop", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "path",
            props: {
              d: "M0 0L10 10",
              fill: "red",
              style: { fill: "blue" },
            },
          },
        },
        x: 0,
        y: 0,
        width: 24,
        height: 24,
      },
      0,
      0,
      false,
    );

    expect(ctx.fillStyle).toBe("blue");
  });

  it("resolves currentColor in SVG fill to the inherited CSS color", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: { color: "red" },
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "path",
            props: {
              d: "M0 0L10 10",
              fill: "currentColor",
            },
          },
        },
        x: 0,
        y: 0,
        width: 24,
        height: 24,
      },
      0,
      0,
      false,
    );

    expect(ctx.fillStyle).toBe("red");
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("resolves currentColor in SVG stroke to the inherited CSS color", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: { color: "green" },
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "path",
            props: {
              d: "M0 0L10 10",
              fill: "none",
              stroke: "currentColor",
            },
          },
        },
        x: 0,
        y: 0,
        width: 24,
        height: 24,
      },
      0,
      0,
      false,
    );

    expect(ctx.strokeStyle).toBe("green");
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("applies hyphenated SVG stroke attributes", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "path",
            props: {
              d: "M0 0L10 10",
              stroke: "red",
              "stroke-width": "3",
              "stroke-linecap": "round",
              "stroke-linejoin": "bevel",
              fill: "none",
            },
          },
        },
        x: 0,
        y: 0,
        width: 24,
        height: 24,
      },
      0,
      0,
      false,
    );

    expect(ctx.strokeStyle).toBe("red");
    expect(ctx.lineWidth).toBe(3);
    expect(ctx.lineCap).toBe("round");
    expect(ctx.lineJoin).toBe("bevel");
  });
});
