import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { buildLayoutTree } from "./layout.ts";

describe("buildLayoutTree", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("wraps root element in a canvas-sized container", async () => {
    const { tree } = await buildLayoutTree("Hello", 200, 200, ctx);
    expect(tree.type).toBe("div");
    expect(tree.width).toBe(200);
    expect(tree.height).toBe(200);
    const child = tree.children[0];
    expect(child.type).toBe("text");
    expect(child.textContent).toBe("Hello");
    expect(child.width).toBeGreaterThan(0);
  });

  it("builds layout for null content", async () => {
    const { tree } = await buildLayoutTree(null, 200, 200, ctx);
    expect(tree.type).toBe("div");
    expect(tree.children[0].type).toBe("empty");
  });

  it("derives svg width from height and viewBox aspect ratio", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "svg",
            props: {
              height: 30,
              viewBox: "0 0 601 600",
              children: { type: "path", props: { d: "M0 0" } },
            },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    expect(svg.width).toBeCloseTo(30 * (601 / 600), 0);
    expect(svg.height).toBe(30);
  });

  it("derives svg height from width and viewBox aspect ratio", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "svg",
            props: { width: 40, viewBox: "0 0 20 10", children: null },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    expect(svg.width).toBe(40);
    expect(svg.height).toBe(20);
  });

  it("uses viewBox dimensions when svg has neither width nor height", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "svg",
            props: { viewBox: "0 0 100 50", children: null },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    expect(svg.width).toBe(100);
    expect(svg.height).toBe(50);
  });

  it("derives img width from height and intrinsic aspect ratio", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 200,
      height: 100,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "img",
            props: { src: "test.png", style: { height: 50 } },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    expect(img.width).toBe(100); // 50 * (200/100) = 100
    expect(img.height).toBe(50);
  });

  it("derives img height from width and intrinsic aspect ratio", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 200,
      height: 100,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "img",
            props: { src: "test.png", style: { width: 100 } },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    expect(img.width).toBe(100);
    expect(img.height).toBe(50); // 100 * (100/200) = 50
  });

  it("uses natural dimensions when img has neither width nor height", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 80,
      height: 40,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "img",
            props: { src: "test.png" },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    // Without explicit dimensions, image fills parent width; aspect ratio derives height.
    expect(img.width).toBe(200);
    expect(img.height).toBe(100);
  });

  it("keeps both dimensions when img has width and height set", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 200,
      height: 100,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "img",
            props: { src: "test.png", style: { width: 60, height: 30 } },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    expect(img.width).toBe(60);
    expect(img.height).toBe(30);
  });

  it("maps HTML width/height attributes to img style", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 200,
      height: 100,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "img",
            props: { src: "test.png", width: 120, height: 60 },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    expect(img.width).toBe(120);
    expect(img.height).toBe(60);
  });

  it("text child fills parent width so textAlign center works", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, textAlign: "center" },
          children: "Hi",
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const textChild = div.children[0];
    expect(textChild.type).toBe("text");
    expect(textChild.width).toBe(200);
  });

  it("text child does not fill parent width when justifyContent is center", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, display: "flex", justifyContent: "center" },
          children: "Hi",
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const textChild = div.children[0];
    expect(textChild.type).toBe("text");
    expect(textChild.width).toBeLessThan(200);
  });

  it("resolves percentage width/height on img to parent size", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 400,
      height: 300,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, height: 200 },
          children: {
            type: "img",
            props: { src: "test.png", width: "100%", height: "100%" },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    expect(img.width).toBe(200);
    expect(img.height).toBe(200);
  });

  it("flattens array children into parent instead of wrapping in implicit div", async () => {
    // Simulates: [<red/>, [<gray/>, <gray/>, <gray/>], <blue/>]
    // Should produce 5 direct children, not 3 (with a wrapper div around the grays)
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { display: "flex", width: 200, height: 200 },
          children: [
            { type: "div", props: { style: { width: 40, height: 40 } } },
            [
              { type: "div", props: { style: { width: 40, height: 40 } } },
              { type: "div", props: { style: { width: 40, height: 40 } } },
              { type: "div", props: { style: { width: 40, height: 40 } } },
            ],
            { type: "div", props: { style: { width: 40, height: 40 } } },
          ],
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const parent = tree.children[0];
    expect(parent.children).toHaveLength(5);
    // All children should be direct divs, no implicit wrapper
    for (const child of parent.children) {
      expect(child.type).toBe("div");
      expect(child.width).toBe(40);
      expect(child.height).toBe(40);
    }
  });

  it("resolves position: absolute on root element against canvas dimensions", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: {
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          },
          children: "Centered",
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    // Root is a wrapper
    expect(tree.x).toBe(0);
    expect(tree.y).toBe(0);
    expect(tree.width).toBe(200);
    expect(tree.height).toBe(200);
    // Child is the absolute-positioned element
    const child = tree.children[0];
    expect(child.x).toBe(20);
    expect(child.y).toBe(20);
    expect(child.width).toBe(160); // 200 - 20 - 20
    expect(child.height).toBe(160); // 200 - 20 - 20
  });
});

describe("buildLayoutTree — SVG viewBox percentage sizing", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("SVG with viewBox + width='100%' inside known-size parent fills parent", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, height: 200 },
          children: {
            type: "svg",
            props: {
              width: "100%",
              viewBox: "0 0 100 100",
              children: null,
            },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    // width="100%" should resolve to parent width (200), not viewBox width (100)
    expect(svg.width).toBe(200);
  });

  it("SVG with viewBox + numeric height only derives width from aspect ratio (regression)", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          children: {
            type: "svg",
            props: {
              height: 50,
              viewBox: "0 0 200 100",
              children: null,
            },
          },
        },
      } as unknown as ReactElement,
      400,
      400,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    expect(svg.width).toBe(100); // 50 * (200/100) = 100
    expect(svg.height).toBe(50);
  });

  it("SVG with viewBox + width='50%' and no height leaves height for Yoga", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, height: 200 },
          children: {
            type: "svg",
            props: {
              width: "50%",
              viewBox: "0 0 100 50",
              children: null,
            },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    // width="50%" → Yoga resolves to 100px; height not derived (% width)
    expect(svg.width).toBe(100);
  });

  it("IMG with width='100%' inside known-size parent fills parent", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 400,
      height: 300,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, height: 200 },
          children: {
            type: "img",
            props: { src: "test.png", width: "100%" },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    // width="100%" resolves to parent width; height derived from 4:3 ratio
    expect(img.width).toBe(200);
    expect(img.height).toBe(150); // 200 / (400/300) = 150
  });

  it("IMG with height='50%' derives width from aspect ratio", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 400,
      height: 200,
    } as never);
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 200, height: 200 },
          children: {
            type: "img",
            props: { src: "test.png", height: "50%" },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const div = tree.children[0];
    const img = div.children[0];
    // height="50%" of 200 = 100; width derived from 2:1 ratio = 200
    expect(img.height).toBe(100);
    expect(img.width).toBe(200);
  });
});

describe("buildLayoutTree — SVG viewport-relative units", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("resolves vw unit on SVG width attribute", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 400, height: 400 },
          children: {
            type: "svg",
            props: {
              width: "25vw",
              viewBox: "0 0 100 100",
              children: null,
            },
          },
        },
      } as unknown as ReactElement,
      400,
      400,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    // 25vw of 400px viewport = 100px
    expect(svg.width).toBe(100);
  });

  it("expands function components inside <svg>", async () => {
    const Bike = () => ({
      type: "circle",
      props: { cx: 5, cy: 5, r: 3, fill: "blue" },
    });
    const { tree } = await buildLayoutTree(
      {
        type: "svg",
        props: {
          width: 24,
          height: 24,
          viewBox: "0 0 10 10",
          children: [
            { type: Bike, props: {} },
            { type: "rect", props: { width: 1, height: 1 } },
          ],
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const svg = tree.children[0];
    const children = svg.props.children as Array<{ type: string }>;
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe("circle");
    expect(children[1].type).toBe("rect");
  });

  it("flattens nested arrays from helpers inside <svg>", async () => {
    const helper = () => [
      { type: "rect", props: { width: 1, height: 1 } },
      { type: "rect", props: { width: 2, height: 2 } },
    ];
    const { tree } = await buildLayoutTree(
      {
        type: "svg",
        props: {
          width: 24,
          height: 24,
          viewBox: "0 0 10 10",
          children: [helper(), helper(), { type: "circle", props: { r: 1 } }],
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const svg = tree.children[0];
    const children = svg.props.children as Array<{ type: string }>;
    expect(children).toHaveLength(5);
    expect(children.map((c) => c.type)).toEqual([
      "rect",
      "rect",
      "rect",
      "rect",
      "circle",
    ]);
  });

  it("unwraps fragments inside <svg>", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "svg",
        props: {
          width: 24,
          height: 24,
          viewBox: "0 0 10 10",
          children: {
            type: Symbol.for("react.fragment"),
            props: {
              children: [
                { type: "circle", props: { cx: 5, cy: 5, r: 3 } },
                { type: "rect", props: { width: 1, height: 1 } },
              ],
            },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const svg = tree.children[0];
    const children = svg.props.children as Array<{ type: string }>;
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.type)).toEqual(["circle", "rect"]);
  });

  it("unwraps fragments returned by function components inside <svg>", async () => {
    const Icon = () => ({
      type: Symbol.for("react.fragment"),
      props: {
        children: [
          { type: "path", props: { d: "M0 0" } },
          { type: "path", props: { d: "M1 1" } },
        ],
      },
    });
    const { tree } = await buildLayoutTree(
      {
        type: "svg",
        props: {
          width: 24,
          height: 24,
          viewBox: "0 0 10 10",
          children: [
            { type: Icon, props: {} },
            { type: "circle", props: { r: 1 } },
          ],
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const svg = tree.children[0];
    const children = svg.props.children as Array<{ type: string }>;
    expect(children).toHaveLength(3);
    expect(children.map((c) => c.type)).toEqual(["path", "path", "circle"]);
  });

  it("unwraps fragments nested inside <g> elements", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "svg",
        props: {
          width: 24,
          height: 24,
          viewBox: "0 0 10 10",
          children: {
            type: "g",
            props: {
              children: {
                type: Symbol.for("react.fragment"),
                props: {
                  children: [
                    { type: "line", props: { x1: 0, y1: 0, x2: 1, y2: 1 } },
                    { type: "ellipse", props: { rx: 1, ry: 2 } },
                  ],
                },
              },
            },
          },
        },
      } as unknown as ReactElement,
      200,
      200,
      ctx,
    );
    const svg = tree.children[0];
    const g = svg.props.children as {
      type: string;
      props: { children: unknown };
    };
    expect(g.type).toBe("g");
    const gChildren = g.props.children as Array<{ type: string }>;
    expect(gChildren).toHaveLength(2);
    expect(gChildren.map((c) => c.type)).toEqual(["line", "ellipse"]);
  });

  it("resolves vh unit on SVG height attribute", async () => {
    const { tree } = await buildLayoutTree(
      {
        type: "div",
        props: {
          style: { width: 800, height: 600 },
          children: {
            type: "svg",
            props: {
              height: "50vh",
              viewBox: "0 0 100 100",
              children: null,
            },
          },
        },
      } as unknown as ReactElement,
      800,
      600,
      ctx,
    );
    const div = tree.children[0];
    const svg = div.children[0];
    // 50vh of 600px viewport = 300px
    expect(svg.height).toBe(300);
    // width derived from viewBox aspect ratio: 300 * (100/100) = 300
    expect(svg.width).toBe(300);
  });
});
