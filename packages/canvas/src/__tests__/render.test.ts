import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @napi-rs/canvas
vi.mock("@napi-rs/canvas", () => {
  const mockCtx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt" as string,
    lineJoin: "miter" as string,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "transparent",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    canvas: { width: 200, height: 200 },
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
    })),
  };

  const mockCanvas = {
    width: 200,
    height: 200,
    getContext: vi.fn(() => mockCtx),
  };

  return {
    createCanvas: vi.fn(() => mockCanvas),
    Canvas: vi.fn(),
    Path2D: vi.fn(() => ({
      rect: vi.fn(),
      roundRect: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      addPath: vi.fn(),
    })),
    GlobalFonts: {
      register: vi.fn(),
      registerFromPath: vi.fn(),
      families: [],
    },
    loadImage: vi.fn(async () => ({
      width: 100,
      height: 100,
    })),
    Image: vi.fn(),
    LottieAnimation: {
      loadFromData: vi.fn(),
    },
  };
});

import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import { expandStyle } from "../jsx/style/expand.ts";
import {
  resolveStyle,
  resolveUnits,
  DEFAULT_STYLE,
} from "../jsx/style/compute.ts";
import type { ExpandedStyle } from "../jsx/style/compute.ts";
import { buildLayoutTree } from "../jsx/layout.ts";
import { drawNode } from "../jsx/draw/index.ts";
import { layoutText } from "../jsx/text/index.ts";

describe("expandStyle", () => {
  it("expands margin shorthand", () => {
    const style = expandStyle({ margin: "10" });
    expect(style.marginTop).toBe(10);
    expect(style.marginRight).toBe(10);
    expect(style.marginBottom).toBe(10);
    expect(style.marginLeft).toBe(10);
  });

  it("expands margin with 2 values", () => {
    const style = expandStyle({ margin: "10 20" });
    expect(style.marginTop).toBe(10);
    expect(style.marginRight).toBe(20);
    expect(style.marginBottom).toBe(10);
    expect(style.marginLeft).toBe(20);
  });

  it("expands padding shorthand", () => {
    const style = expandStyle({ padding: "5 10 15 20" });
    expect(style.paddingTop).toBe(5);
    expect(style.paddingRight).toBe(10);
    expect(style.paddingBottom).toBe(15);
    expect(style.paddingLeft).toBe(20);
  });

  it("expands borderRadius shorthand", () => {
    const style = expandStyle({ borderRadius: "8" });
    expect(style.borderTopLeftRadius).toBe(8);
    expect(style.borderTopRightRadius).toBe(8);
    expect(style.borderBottomRightRadius).toBe(8);
    expect(style.borderBottomLeftRadius).toBe(8);
  });

  it("expands border shorthand", () => {
    const style = expandStyle({ border: "2 solid red" });
    expect(style.borderTopWidth).toBe(2);
    expect(style.borderTopStyle).toBe("solid");
    expect(style.borderTopColor).toBe("red");
  });

  it("expands flex shorthand", () => {
    const style = expandStyle({ flex: "1" });
    expect(style.flexGrow).toBe(1);
    expect(style.flexShrink).toBe(1);
    expect(style.flexBasis).toBe(0);
  });

  it("expands gap shorthand", () => {
    const style = expandStyle({ gap: "10 20" });
    expect(style.rowGap).toBe(10);
    expect(style.columnGap).toBe(20);
  });

  it("preserves percentage borderRadius strings", () => {
    const style = expandStyle({ borderRadius: "50%" });
    expect(style.borderTopLeftRadius).toBe("50%");
    expect(style.borderTopRightRadius).toBe("50%");
    expect(style.borderBottomRightRadius).toBe("50%");
    expect(style.borderBottomLeftRadius).toBe("50%");
  });

  it("preserves unit strings in margin shorthand", () => {
    const style = expandStyle({ margin: "2em" });
    expect(style.marginTop).toBe("2em");
    expect(style.marginRight).toBe("2em");
    expect(style.marginBottom).toBe("2em");
    expect(style.marginLeft).toBe("2em");
  });

  it("preserves unit strings in borderRadius shorthand", () => {
    const style = expandStyle({ borderRadius: "10px" });
    expect(style.borderTopLeftRadius).toBe("10px");
    expect(style.borderTopRightRadius).toBe("10px");
    expect(style.borderBottomRightRadius).toBe("10px");
    expect(style.borderBottomLeftRadius).toBe("10px");
  });

  it("normalizes fontFamily", () => {
    const style = expandStyle({ fontFamily: "'Inter', sans-serif" });
    expect(style.fontFamily).toBe("Inter, sans-serif");
  });

  it("does not overwrite explicit longhand values", () => {
    const style = expandStyle({ margin: "10", marginTop: 20 });
    expect(style.marginTop).toBe(20);
    expect(style.marginRight).toBe(10);
  });
});

describe("resolveStyle", () => {
  it("inherits color from parent", () => {
    const style = resolveStyle({}, { ...DEFAULT_STYLE, color: "red" });
    expect(style.color).toBe("red");
  });

  it("inherits fontSize from parent", () => {
    const style = resolveStyle({}, { ...DEFAULT_STYLE, fontSize: 24 });
    expect(style.fontSize).toBe(24);
  });

  it("overrides inherited properties", () => {
    const style = resolveStyle(
      { color: "blue" },
      { ...DEFAULT_STYLE, color: "red" },
    );
    expect(style.color).toBe("blue");
  });

  it("resolves fontSize with em units relative to parent fontSize", () => {
    const input: ExpandedStyle = { fontSize: "4em" };
    const style = resolveStyle(input, { ...DEFAULT_STYLE, fontSize: 16 });
    expect(style.fontSize).toBe(64);
  });

  it("resolves fontSize with rem units relative to root fontSize", () => {
    const input: ExpandedStyle = { fontSize: "2rem" };
    const style = resolveStyle(input, DEFAULT_STYLE);
    expect(style.fontSize).toBe(2 * DEFAULT_STYLE.fontSize!);
  });

  it("resolves fontSize with px units", () => {
    const input: ExpandedStyle = { fontSize: "24px" };
    const style = resolveStyle(input, DEFAULT_STYLE);
    expect(style.fontSize).toBe(24);
  });

  it("preserves lineHeight multiplier for per-element resolution", () => {
    const style = resolveStyle(
      { lineHeight: 1.5 as number | string, fontSize: 20 },
      DEFAULT_STYLE,
    );
    // Multipliers (<=5) are kept as-is and resolved in text layout
    // using each element's own fontSize
    expect(style.lineHeight).toBe(1.5);
  });
});

describe("resolveUnits", () => {
  it("resolves vw to pixels using viewport width", () => {
    const style = resolveUnits({ width: "50vw" }, 800, 600);
    expect(style.width).toBe(400);
  });

  it("resolves vh to pixels using viewport height", () => {
    const style = resolveUnits({ height: "100vh" }, 800, 600);
    expect(style.height).toBe(600);
  });

  it("resolves vmin to the smaller viewport dimension", () => {
    const style = resolveUnits({ width: "50vmin" }, 800, 600);
    expect(style.width).toBe(300);
  });

  it("resolves vmax to the larger viewport dimension", () => {
    const style = resolveUnits({ width: "50vmax" }, 800, 600);
    expect(style.width).toBe(400);
  });

  it("resolves em relative to the element fontSize", () => {
    const style = resolveUnits({ width: "2em", fontSize: 20 }, 800, 600);
    expect(style.width).toBe(40);
  });

  it("resolves rem relative to root fontSize", () => {
    const style = resolveUnits({ width: "2rem" }, 800, 600, 16);
    expect(style.width).toBe(32);
  });

  it("resolves px explicitly", () => {
    const style = resolveUnits({ width: "120px" }, 800, 600);
    expect(style.width).toBe(120);
  });

  it("resolves pt (1pt = 96/72 px)", () => {
    const style = resolveUnits({ width: "72pt" }, 800, 600);
    expect(style.width).toBe(96);
  });

  it("resolves in (1in = 96px)", () => {
    const style = resolveUnits({ width: "1in" }, 800, 600);
    expect(style.width).toBe(96);
  });

  it("resolves cm", () => {
    const style = resolveUnits({ width: "2.54cm" }, 800, 600);
    expect(style.width).toBeCloseTo(96, 5);
  });

  it("resolves mm", () => {
    const style = resolveUnits({ width: "25.4mm" }, 800, 600);
    expect(style.width).toBeCloseTo(96, 5);
  });

  it("passes through plain numbers unchanged", () => {
    const style = resolveUnits({ width: 200 }, 800, 600);
    expect(style.width).toBe(200);
  });

  it("passes through percentage strings unchanged", () => {
    const style = resolveUnits({ width: "50%" }, 800, 600);
    expect(style.width).toBe("50%");
  });

  it("passes through auto unchanged", () => {
    const style = resolveUnits({ width: "auto" }, 800, 600);
    expect(style.width).toBe("auto");
  });

  it("resolves multiple properties at once", () => {
    const style = resolveUnits(
      {
        width: "100vw",
        height: "100vh",
        marginTop: "10vh",
        paddingLeft: "5vw",
      },
      400,
      300,
    );
    expect(style.width).toBe(400);
    expect(style.height).toBe(300);
    expect(style.marginTop).toBe(30);
    expect(style.paddingLeft).toBe(20);
  });
});

describe("layoutText", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("lays out single line text", () => {
    const result = layoutText(
      "Hello",
      { fontSize: 16, color: "black" },
      500,
      ctx,
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe("Hello");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("applies text transform uppercase", () => {
    const result = layoutText(
      "hello",
      { fontSize: 16, color: "black", textTransform: "uppercase" },
      500,
      ctx,
    );
    expect(result.segments[0]!.text).toBe("HELLO");
  });

  it("applies text transform lowercase", () => {
    const result = layoutText(
      "HELLO",
      { fontSize: 16, color: "black", textTransform: "lowercase" },
      500,
      ctx,
    );
    expect(result.segments[0]!.text).toBe("hello");
  });

  it("clamps lines with lineClamp and adds ellipsis", () => {
    const longText =
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";
    const unclamped = layoutText(
      longText,
      { fontSize: 16, color: "black" },
      150,
      ctx,
    );
    expect(unclamped.segments.length).toBeGreaterThan(2);

    const clamped = layoutText(
      longText,
      { fontSize: 16, color: "black", lineClamp: 2 },
      150,
      ctx,
    );
    expect(clamped.segments).toHaveLength(2);
    expect(clamped.segments[1]!.text).toContain("\u2026");
    expect(clamped.height).toBeLessThan(unclamped.height);
  });

  it("does not clamp when text fits within lineClamp", () => {
    const result = layoutText(
      "Short",
      { fontSize: 16, color: "black", lineClamp: 3 },
      500,
      ctx,
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe("Short");
  });
});

describe("buildLayoutTree", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("wraps root element in a canvas-sized container", async () => {
    const tree = await buildLayoutTree("Hello", 200, 200, ctx);
    expect(tree.type).toBe("div");
    expect(tree.width).toBe(200);
    expect(tree.height).toBe(200);
    const child = tree.children[0];
    expect(child.type).toBe("text");
    expect(child.textContent).toBe("Hello");
    expect(child.width).toBeGreaterThan(0);
  });

  it("builds layout for null content", async () => {
    const tree = await buildLayoutTree(null, 200, 200, ctx);
    expect(tree.type).toBe("div");
    expect(tree.children[0].type).toBe("empty");
  });

  it("derives svg width from height and viewBox aspect ratio", async () => {
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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

  it("does not force natural dimensions when img has neither width nor height", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 80,
      height: 40,
    } as never);
    const tree = await buildLayoutTree(
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
    // Without explicit dimensions, Yoga sizes from layout constraints only.
    // In a default flex-column container the child stretches on the cross
    // axis (height) but collapses on the main axis (width).
    expect(img.width).toBe(0);
    expect(img.height).toBe(200);
  });

  it("keeps both dimensions when img has width and height set", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 200,
      height: 100,
    } as never);
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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

  it("resolves percentage width/height on img to parent size", async () => {
    vi.mocked(loadImage).mockResolvedValueOnce({
      width: 400,
      height: 300,
    } as never);
    const tree = await buildLayoutTree(
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

  it("resolves position: absolute on root element against canvas dimensions", async () => {
    const tree = await buildLayoutTree(
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

describe("drawNode", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("draws a rectangle with backgroundColor", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { backgroundColor: "red" },
        children: [],
        props: {},
        x: 10,
        y: 10,
        width: 100,
        height: 50,
      },
      0,
      0,
      false,
    );

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 10, 100, 50);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("skips nodes with display:none", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { display: "none", backgroundColor: "red" },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
      false,
    );

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("skips nodes with opacity 0", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { opacity: 0, backgroundColor: "red" },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
      false,
    );

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("draws debug bounding boxes", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {},
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
      true,
    );

    expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 100, 50);
  });

  it("draws text content", async () => {
    await drawNode(
      ctx,
      {
        type: "span",
        style: { fontSize: 16, fontFamily: "sans-serif", color: "black" },
        children: [],
        textContent: "Hello",
        props: {},
        x: 0,
        y: 0,
        width: 200,
        height: 50,
      },
      0,
      0,
      false,
    );

    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("applies overflow hidden clipping", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { overflow: "hidden" },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
      false,
    );

    expect(ctx.clip).toHaveBeenCalled();
  });

  it("recursively draws children", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {},
        children: [
          {
            type: "div",
            style: { backgroundColor: "blue" },
            children: [],
            props: {},
            x: 5,
            y: 5,
            width: 50,
            height: 30,
          },
        ],
        props: {},
        x: 10,
        y: 10,
        width: 100,
        height: 50,
      },
      0,
      0,
      false,
    );

    // Child drawn at parent offset + child offset
    expect(ctx.fillRect).toHaveBeenCalledWith(15, 15, 50, 30);
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

  // ---------- rect rx/ry rounded corners ----------

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

  // ---------- mask ----------

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
});

describe("percentage unit handling", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("SVG with viewBox + width='100%' inside known-size parent fills parent", async () => {
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    const tree = await buildLayoutTree(
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
    // width="100%" should resolve to parent width, not aspect-ratio derived
    expect(img.width).toBe(200);
  });

  it("padding as percentage correctly insets content", async () => {
    await drawNode(
      ctx,
      {
        type: "span",
        style: {
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "black",
          paddingLeft: "10%",
          paddingRight: "10%",
        },
        children: [],
        textContent: "Hello",
        props: {},
        x: 0,
        y: 0,
        width: 200,
        height: 50,
      },
      0,
      0,
      false,
    );

    // 10% of 200px width = 20px padding on each side
    expect(ctx.fillText).toHaveBeenCalled();
    // First call args: text, x, y — x should be offset by padding (20)
    const fillTextCall = vi.mocked(ctx.fillText).mock.calls[0];
    expect(fillTextCall![1]).toBe(20);
  });
});
