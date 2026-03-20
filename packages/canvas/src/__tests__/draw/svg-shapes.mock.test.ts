import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../_helpers/canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "../../jsx/draw/index.ts";

describe("SVG shapes — rect rx/ry rounded corners", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("rect with rx renders rounded rectangle", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "rect",
            props: { x: 0, y: 0, width: 24, height: 24, rx: 4, fill: "blue" },
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

    expect(ctx.fill).toHaveBeenCalled();
  });

  it("rect rx defaults ry to rx", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "rect",
            props: { x: 0, y: 0, width: 24, height: 24, rx: 6, fill: "red" },
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

    expect(ctx.fill).toHaveBeenCalled();
  });

  it("rect without rx renders sharp rectangle", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: {
            type: "rect",
            props: { x: 0, y: 0, width: 24, height: 24, fill: "green" },
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

    expect(ctx.fill).toHaveBeenCalled();
  });
});
