import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "./index.ts";

describe("SVG defs — mask handling", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("mask element is skipped as non-drawable", async () => {
    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: [
            {
              type: "defs",
              props: {
                children: {
                  type: "mask",
                  props: {
                    id: "m",
                    children: {
                      type: "rect",
                      props: {
                        x: 0,
                        y: 0,
                        width: 24,
                        height: 24,
                        fill: "white",
                      },
                    },
                  },
                },
              },
            },
            {
              type: "path",
              props: { d: "M0 0L10 10", fill: "red" },
            },
          ],
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

    // Only the <path> should produce a fill call, not the mask definition
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });

  it("mask='url(#id)' applies mask via compositing", async () => {
    vi.mocked(createCanvas).mockClear();

    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: [
            {
              type: "defs",
              props: {
                children: {
                  type: "mask",
                  props: {
                    id: "m",
                    children: {
                      type: "rect",
                      props: {
                        x: 0,
                        y: 0,
                        width: 24,
                        height: 24,
                        fill: "white",
                      },
                    },
                  },
                },
              },
            },
            {
              type: "path",
              props: { d: "M0 0L10 10", fill: "red", mask: "url(#m)" },
            },
          ],
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

    // Offscreen canvases created for element + mask
    expect(createCanvas).toHaveBeenCalled();
    // Composited result drawn back to main context
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("element without mask renders normally", async () => {
    vi.mocked(createCanvas).mockClear();

    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: [
            {
              type: "defs",
              props: {
                children: {
                  type: "mask",
                  props: {
                    id: "m",
                    children: {
                      type: "rect",
                      props: {
                        x: 0,
                        y: 0,
                        width: 24,
                        height: 24,
                        fill: "white",
                      },
                    },
                  },
                },
              },
            },
            {
              type: "path",
              props: { d: "M0 0L10 10", fill: "red" },
            },
          ],
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

    // No offscreen canvas created when element doesn't reference a mask
    // createCanvas is called once for the initial setup in beforeEach,
    // but clearAllMocks resets it, and we cleared again above
    expect(createCanvas).not.toHaveBeenCalled();
  });

  it("top-level mask (outside <defs>) is collected and applied", async () => {
    vi.mocked(createCanvas).mockClear();

    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 24 24",
          children: [
            {
              type: "mask",
              props: {
                id: "topMask",
                children: {
                  type: "rect",
                  props: {
                    x: 0,
                    y: 0,
                    width: 24,
                    height: 24,
                    fill: "white",
                  },
                },
              },
            },
            {
              type: "path",
              props: { d: "M0 0L10 10", fill: "red", mask: "url(#topMask)" },
            },
          ],
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

    // Offscreen canvases created for element + mask (same as defs-wrapped case)
    expect(createCanvas).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});
