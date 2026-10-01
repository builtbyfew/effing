import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@effing/skia", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("@effing/skia/extensions", async () => {
  const { createExtensionsMock } = await import("../../canvas-mock.ts");
  return createExtensionsMock();
});

import { createCanvas } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";
import { fillParagraph } from "@effing/skia/extensions";
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

    // Laid out and painted as one native paragraph, at the content origin.
    expect(fillParagraph).toHaveBeenCalledWith(ctx, expect.anything(), 0, 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws text the paragraph can't express through fillText", async () => {
    await drawNode(
      ctx,
      {
        type: "span",
        style: {
          fontSize: 16,
          fontFamily: "sans-serif",
          color: "black",
          wordBreak: "break-all",
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

    expect(ctx.fillText).toHaveBeenCalled();
    expect(fillParagraph).not.toHaveBeenCalled();
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

  it("draws pure-scale transforms straight through the transform", async () => {
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

    // No supersampled offscreen buffer: the scale is applied to the context
    // and the element painted through it.
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.scale).toHaveBeenCalledWith(0.9, 0.9);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 50);
  });

  it("applies transforms combining scale with translate to the context", async () => {
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

    expect(ctx.drawImage).not.toHaveBeenCalled();
    // Translate from the transform was applied directly to ctx (80px, 0)
    expect(ctx.translate).toHaveBeenCalledWith(80, 0);
    // Scale also applied directly to ctx
    expect(ctx.scale).toHaveBeenCalledWith(0.9, 0.9);
  });

  it("applies transforms combining scale with rotate to the context", async () => {
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

    // 10% of 200px width = 20px padding on each side: the paragraph is
    // painted with its left edge offset by the padding.
    expect(fillParagraph).toHaveBeenCalledWith(ctx, expect.anything(), 20, 0);
  });
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
});
