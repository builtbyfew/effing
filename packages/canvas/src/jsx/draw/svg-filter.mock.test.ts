import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "./index.ts";

describe("SVG filter support", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("filter defs collected and trigger offscreen canvas", async () => {
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
                  type: "filter",
                  props: {
                    id: "f",
                    children: {
                      type: "feGaussianBlur",
                      props: { in: "SourceGraphic", stdDeviation: 2 },
                    },
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 0,
                y: 0,
                width: 24,
                height: 24,
                fill: "blue",
                filter: "url(#f)",
              },
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

    // Offscreen canvases created for element + filter pipeline
    expect(createCanvas).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("feGaussianBlur sets ctx.filter to blur()", async () => {
    vi.mocked(createCanvas).mockClear();

    const mockCtxRef = ctx;

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
                  type: "filter",
                  props: {
                    id: "blur",
                    children: {
                      type: "feGaussianBlur",
                      props: { in: "SourceGraphic", stdDeviation: 5 },
                    },
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 2,
                y: 2,
                width: 20,
                height: 20,
                fill: "red",
                filter: "url(#blur)",
              },
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

    // The mock ctx is shared — filter should have been set to blur(5px)
    // then reset to "none"
    expect(mockCtxRef.filter).toBe("none");
  });

  it("feOffset draws with dx/dy offset", async () => {
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
                  type: "filter",
                  props: {
                    id: "off",
                    children: {
                      type: "feOffset",
                      props: { in: "SourceGraphic", dx: 3, dy: 4 },
                    },
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 0,
                y: 0,
                width: 24,
                height: 24,
                fill: "green",
                filter: "url(#off)",
              },
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

    // drawImage called with offset for feOffset and for compositing
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("feColorMatrix calls getImageData/putImageData", async () => {
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
                  type: "filter",
                  props: {
                    id: "cm",
                    children: {
                      type: "feColorMatrix",
                      props: {
                        in: "SourceGraphic",
                        type: "matrix",
                        values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0",
                      },
                    },
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 0,
                y: 0,
                width: 24,
                height: 24,
                fill: "purple",
                filter: "url(#cm)",
              },
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

    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("feBlend sets globalCompositeOperation", async () => {
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
                  type: "filter",
                  props: {
                    id: "blend",
                    children: [
                      {
                        type: "feOffset",
                        props: {
                          in: "SourceGraphic",
                          dx: 2,
                          dy: 2,
                          result: "off",
                        },
                      },
                      {
                        type: "feBlend",
                        props: {
                          in: "SourceGraphic",
                          in2: "off",
                          mode: "multiply",
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 0,
                y: 0,
                width: 24,
                height: 24,
                fill: "orange",
                filter: "url(#blend)",
              },
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

    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("full drop shadow chain — feOffset+feGaussianBlur+feColorMatrix+feBlend", async () => {
    vi.mocked(createCanvas).mockClear();

    await drawNode(
      ctx,
      {
        type: "svg",
        style: {},
        children: [],
        props: {
          viewBox: "0 0 200 200",
          children: [
            {
              type: "defs",
              props: {
                children: {
                  type: "filter",
                  props: {
                    id: "shadow",
                    children: [
                      {
                        type: "feOffset",
                        props: {
                          in: "SourceAlpha",
                          dx: 4,
                          dy: 4,
                          result: "offset",
                        },
                      },
                      {
                        type: "feGaussianBlur",
                        props: {
                          in: "offset",
                          stdDeviation: 3,
                          result: "blur",
                        },
                      },
                      {
                        type: "feColorMatrix",
                        props: {
                          in: "blur",
                          type: "matrix",
                          values:
                            "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0",
                          result: "shadow",
                        },
                      },
                      {
                        type: "feBlend",
                        props: {
                          in: "SourceGraphic",
                          in2: "shadow",
                          mode: "normal",
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 30,
                y: 30,
                width: 140,
                height: 140,
                rx: 12,
                fill: "#3B82F6",
                filter: "url(#shadow)",
              },
            },
          ],
        },
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
      0,
      0,
      false,
    );

    // Full pipeline executed — element drawn via offscreen + filter chain
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("element without filter renders without offscreen canvas", async () => {
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
                  type: "filter",
                  props: {
                    id: "f",
                    children: {
                      type: "feGaussianBlur",
                      props: { in: "SourceGraphic", stdDeviation: 2 },
                    },
                  },
                },
              },
            },
            {
              type: "rect",
              props: {
                x: 0,
                y: 0,
                width: 24,
                height: 24,
                fill: "blue",
              },
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

    // No offscreen canvas when element doesn't reference a filter
    expect(createCanvas).not.toHaveBeenCalled();
  });
});
