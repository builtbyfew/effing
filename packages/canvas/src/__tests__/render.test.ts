import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @napi-rs/canvas
vi.mock("@napi-rs/canvas", () => {
  const mockCtx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
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

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import { expandStyle } from "../jsx/style/expand.ts";
import { resolveStyle, DEFAULT_STYLE } from "../jsx/style/compute.ts";
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
});

describe("buildLayoutTree", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
  });

  it("builds layout for string content", () => {
    const tree = buildLayoutTree("Hello", 200, 200, ctx);
    expect(tree.type).toBe("text");
    expect(tree.textContent).toBe("Hello");
    expect(tree.width).toBeGreaterThan(0);
  });

  it("builds layout for null content", () => {
    const tree = buildLayoutTree(null, 200, 200, ctx);
    expect(tree.type).toBe("empty");
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
});
