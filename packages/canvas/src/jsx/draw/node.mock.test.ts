import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

import { createCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { drawNode } from "./index.ts";

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
      { imageCache: new Map(), debug: true },
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
    );

    // Child drawn at parent offset + child offset
    expect(ctx.fillRect).toHaveBeenCalledWith(15, 15, 50, 30);
  });

  it("uses offscreen compositing for pure-scale transforms", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          backgroundColor: "red",
          transform: "scale(0.9)",
        },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    // Pure scale renders to an offscreen and composites with drawImage.
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("bypasses offscreen for transforms combining scale with translate", async () => {
    // Repro of the mixed-transform clipping bug: an offscreen sized only to
    // the layout box would clip drawing the translate moves outside it.
    // The fix is to render directly to ctx with the full transform applied.
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          backgroundColor: "red",
          transform: "translate(80px, 0px) scale(0.9)",
          transformOrigin: "left center",
        },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    // No offscreen compositing
    expect(ctx.drawImage).not.toHaveBeenCalled();
    // Translate from the transform was applied directly to ctx (80px, 0)
    expect(ctx.translate).toHaveBeenCalledWith(80, 0);
    // Scale also applied directly to ctx
    expect(ctx.scale).toHaveBeenCalledWith(0.9, 0.9);
  });

  it("bypasses offscreen for transforms combining scale with rotate", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          backgroundColor: "red",
          transform: "rotate(-6deg) scale(0.9)",
        },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
    expect(ctx.scale).toHaveBeenCalledWith(0.9, 0.9);
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
    );

    // 10% of 200px width = 20px padding on each side
    expect(ctx.fillText).toHaveBeenCalled();
    // First call args: text, x, y — x should be offset by padding (20)
    const fillTextCall = vi.mocked(ctx.fillText).mock.calls[0];
    expect(fillTextCall![1]).toBe(20);
  });

  // drawImage signature: (image, sx, sy, sW, sH, dx, dy, dW, dH).
  // The composite dest spans the bleed-expanded box, so dW/dH reveal the bleed.
  const compositeDestWidth = () => {
    const call = vi.mocked(ctx.drawImage).mock.calls.at(-1)!;
    return call[7] as number;
  };

  it("grows the offscreen buffer to fit ink that overflows the scaled box", async () => {
    // A CSS transform must not clip the element's own content. Glyph ink
    // overhangs its box, so the offscreen scale buffer must bleed by ~1em
    // (plus any negative letter-spacing) rather than the old fixed 1px.
    await drawNode(
      ctx,
      {
        type: "span",
        style: { transform: "scale(1.1)", fontSize: 80, color: "white" },
        children: [
          {
            type: "text",
            style: { fontSize: 80, letterSpacing: -10, color: "white" },
            children: [],
            textContent: "AVA.",
            props: {},
            x: 0,
            y: 0,
            width: 100,
            height: 90,
          },
        ],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 90,
      },
      0,
      0,
    );

    // bleed = fontSize (80) + |letterSpacing| (10) = 90 per side.
    expect(compositeDestWidth()).toBe(100 + 2 * 90);
  });

  it("grows the offscreen buffer to fit a scaled element's box-shadow", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          transform: "scale(1.1)",
          backgroundColor: "red",
          boxShadow: "0px 0px 20px black",
        },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    // bleed = blur*2 + |offsetX| + |offsetY| = 40 per side.
    expect(compositeDestWidth()).toBe(100 + 2 * 40);
  });

  it("keeps the buffer tight (1px bleed) when nothing overflows the box", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { transform: "scale(0.9)", backgroundColor: "red" },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    expect(compositeDestWidth()).toBe(100 + 2 * 1);
  });

  // Just past a whole scale, text fades between two supersample factors, each
  // composited at its weight; anything else composites a single buffer.
  it.each([
    ["a text-free subtree", "1.02", undefined, 20, [1]],
    ["a subtree with text", "1.02", "Hi", 20, [0.6, 0.4]],
    ["default-size text (no fontSize)", "1.02", "Hi", undefined, [0.6, 0.4]],
    ["float noise above scale 1", "1.0000000000000002", "Hi", 20, [1]],
    // Non-uniform: each axis blends on its own, so the levels are the
    // combinations of the two axes' factors, weighted by the product.
    [
      "both axes in their bands",
      "1.02, 2.03",
      "Hi",
      20,
      [0.24, 0.36, 0.16, 0.24],
    ],
    // Products that fall below the minimum weight are pruned and the rest
    // renormalised: 0.998×{0.4, 0.6} survives, 0.002×{0.4, 0.6} does not.
    [
      "one axis barely past a whole scale",
      "1.0001, 2.03",
      "Hi",
      20,
      [0.4, 0.6],
    ],
  ])(
    "composites supersample levels at their weights for %s",
    async (_, scale, textContent, fontSize, weights) => {
      // The mock shares one context (and one drawImage spy) across tests, so
      // record the alpha each buffer composite (the 9-argument drawImage) is
      // drawn with, and undo the recording implementation and the state the
      // blend leaves on the context even when an assertion throws.
      ctx.globalAlpha = 1;
      const alphas: number[] = [];
      vi.mocked(ctx.drawImage).mockImplementation((...args: unknown[]) => {
        if (args.length === 9) alphas.push(ctx.globalAlpha);
      });

      try {
        await drawNode(
          ctx,
          {
            type: "div",
            style: { transform: `scale(${scale})`, backgroundColor: "red" },
            children: [
              {
                type: "span",
                style: { fontSize, color: "white" },
                children: [],
                textContent,
                props: {},
                x: 0,
                y: 0,
                width: 20,
                height: 20,
              },
            ],
            props: {},
            x: 0,
            y: 0,
            width: 100,
            height: 50,
          },
          0,
          0,
        );

        expect(alphas).toHaveLength(weights.length);
        alphas.forEach((alpha, i) => expect(alpha).toBeCloseTo(weights[i]!));
      } finally {
        vi.mocked(ctx.drawImage).mockReset();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    },
  );

  it("bleeds the buffer by the default font size for text without a fontSize", async () => {
    // layoutText draws text at 16px when the style has no fontSize, so the
    // scan must reserve the same overflow instead of treating it as no text.
    await drawNode(
      ctx,
      {
        type: "span",
        style: { transform: "scale(1.1)", color: "white" },
        children: [
          {
            type: "text",
            style: { color: "white" },
            children: [],
            textContent: "AVA.",
            props: {},
            x: 0,
            y: 0,
            width: 100,
            height: 20,
          },
        ],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 20,
      },
      0,
      0,
    );

    expect(compositeDestWidth()).toBe(100 + 2 * 16);
  });

  it.each([NaN, Infinity])(
    "draws a scaled node with a %s size directly instead of buffering",
    async (width) => {
      // A NaN or infinite box (layout edge case) can't back an offscreen
      // buffer; the node must fall through to the direct path rather than
      // create a canvas with that size.
      await drawNode(
        ctx,
        {
          type: "div",
          style: { transform: "scale(0.9)", backgroundColor: "red" },
          children: [],
          props: {},
          x: 0,
          y: 0,
          width,
          height: 50,
        },
        0,
        0,
      );

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.scale).toHaveBeenCalledWith(0.9, 0.9);
    },
  );
});

describe("drawNode – clip-path", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("clips to the clip-path before painting the background", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { clipPath: "circle(50%)", backgroundColor: "red" },
        children: [],
        props: {},
        x: 10,
        y: 10,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    const clip = vi.mocked(ctx.clip);
    expect(clip).toHaveBeenCalledTimes(1);
    expect(clip.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ arc: expect.any(Function) }),
    );
    expect(clip.mock.calls[0]![1]).toBe("nonzero");
    expect(clip.mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(ctx.fillRect).mock.invocationCallOrder[0]!,
    );
  });

  it("clips box-shadow too", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          clipPath: "polygon(evenodd, 0 0, 100% 0, 50% 100%)",
          boxShadow: "0 0 10px black",
          backgroundColor: "red",
        },
        children: [],
        props: {},
        x: 10,
        y: 10,
        width: 100,
        height: 50,
      },
      0,
      0,
    );

    const clip = vi.mocked(ctx.clip);
    // The clip-path clip comes first; drawBoxShadow adds its own evenodd clip.
    expect(clip.mock.calls[0]![1]).toBe("evenodd");
    expect(clip.mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(ctx.fill).mock.invocationCallOrder[0]!,
    );
  });

  it("ignores clip-path: none and invalid values", async () => {
    for (const clipPath of ["none", "url(#foo)"]) {
      vi.clearAllMocks();
      await drawNode(
        ctx,
        {
          type: "div",
          style: { clipPath, backgroundColor: "red" },
          children: [],
          props: {},
          x: 0,
          y: 0,
          width: 100,
          height: 50,
        },
        0,
        0,
      );
      expect(ctx.clip).not.toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
    }
  });
});

describe("drawNode – backdrop-filter", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  it("snapshots the backdrop, filters it and paints it back before the background", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          backdropFilter: "blur(4px)",
          backgroundColor: "rgba(255,255,255,0.2)",
        },
        children: [],
        props: {},
        x: 50,
        y: 60,
        width: 100,
        height: 40,
      },
      0,
      0,
    );

    const drawImage = vi.mocked(ctx.drawImage);
    expect(drawImage).toHaveBeenCalledTimes(3);
    // Snapshot: the padded device-space region (bleed = 3σ + 1 = 13px), drawn
    // at its device position into a buffer translated by (-37, -47).
    expect(ctx.translate).toHaveBeenCalledWith(-37, -47);
    expect(drawImage.mock.calls[0]).toEqual([
      ctx.canvas,
      37,
      47,
      126,
      66,
      37,
      47,
      126,
      66,
    ]);
    // The filter pass copies the snapshot into a second buffer.
    expect(drawImage.mock.calls[1]!.slice(1)).toEqual([0, 0]);
    // Paint back at the same device position, under an identity transform.
    expect(drawImage.mock.calls[2]!.slice(1)).toEqual([
      0, 0, 126, 66, 37, 47, 126, 66,
    ]);
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    // Clipped to the border box, and painted before the background fill.
    expect(ctx.rect).toHaveBeenCalledWith(50, 60, 100, 40);
    expect(ctx.clip).toHaveBeenCalled();
    expect(drawImage.mock.invocationCallOrder[2]!).toBeLessThan(
      vi.mocked(ctx.fillRect).mock.invocationCallOrder[0]!,
    );
  });

  it("extends the canvas edge under a snapshot that reaches past it", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { backdropFilter: "blur(10px)" },
        children: [],
        props: {},
        x: -20,
        y: 180,
        width: 100,
        height: 40,
      },
      0,
      0,
    );
    // Padded region: x -51..111, y 149..251 on a 200×200 canvas. The part
    // inside the canvas is copied as is; the strips past the left and bottom
    // edges (and their corner) stretch the boundary pixels outward.
    const calls = vi.mocked(ctx.drawImage).mock.calls.map((c) => c.slice(1));
    expect(calls).toEqual([
      [0, 149, 111, 51, 0, 149, 111, 51],
      [0, 149, 1, 51, -51, 149, 51, 51],
      [0, 199, 111, 1, 0, 200, 111, 51],
      [0, 199, 1, 1, -51, 200, 51, 51],
      [0, 0],
      [0, 0, 162, 102, -51, 149, 162, 102],
    ]);
  });

  it("runs before the element's own box-shadow", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { backdropFilter: "blur(4px)", boxShadow: "0 0 10px black" },
        children: [],
        props: {},
        x: 50,
        y: 60,
        width: 100,
        height: 40,
      },
      0,
      0,
    );
    // The shadow must not be part of the snapshot: the backdrop paint-back
    // (last drawImage) precedes drawBoxShadow's evenodd clip.
    const drawImage = vi.mocked(ctx.drawImage);
    const clip = vi.mocked(ctx.clip);
    const shadowClip = clip.mock.calls.findIndex(
      (c) => (c as unknown[])[0] === "evenodd",
    );
    expect(shadowClip).toBeGreaterThanOrEqual(0);
    expect(drawImage.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      clip.mock.invocationCallOrder[shadowClip]!,
    );
  });

  it("skips backdrop-filter: none", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { backdropFilter: "none", backgroundColor: "red" },
        children: [],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
      0,
      0,
    );
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("bypasses the offscreen scale path when the subtree has a backdrop-filter", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { transform: "scale(2)" },
        children: [
          {
            type: "div",
            style: { backdropFilter: "blur(2px)" },
            children: [],
            props: {},
            x: 0,
            y: 0,
            width: 50,
            height: 50,
          },
        ],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      0,
      0,
    );
    // The scale is applied directly to the context (ctx.scale) rather than via
    // an offscreen buffer composited with drawImage: no drawImage maps a
    // buffer onto the bleed-expanded box (-1, -1, 102, 102).
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    const composite = vi
      .mocked(ctx.drawImage)
      .mock.calls.find((c) => c[5] === -1 && c[6] === -1 && c[7] === 102);
    expect(composite).toBeUndefined();
  });

  it("ignores invisible backdrop-filter descendants when picking the offscreen path", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: { transform: "scale(2)" },
        children: [
          {
            type: "div",
            style: { backdropFilter: "blur(2px)", opacity: 0 },
            children: [],
            props: {},
            x: 0,
            y: 0,
            width: 50,
            height: 50,
          },
        ],
        props: {},
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      0,
      0,
    );
    // A fully transparent child is never drawn, so it must not force the
    // direct path: the subtree renders offscreen and is composited once.
    const drawImage = vi.mocked(ctx.drawImage);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0]!.slice(5)).toEqual([-1, -1, 102, 102]);
  });
});
