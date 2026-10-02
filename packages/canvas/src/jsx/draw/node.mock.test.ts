import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@effing/skia", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

vi.mock("@effing/skia/extensions", async () => {
  const { createExtensionsMock } = await import("../../canvas-mock.ts");
  return createExtensionsMock();
});

import { createCanvas, loadImage } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";
import { beginGroup, endGroup, fillParagraph } from "@effing/skia/extensions";
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

describe("drawNode – opacity and filter", () => {
  let ctx: SKRSContext2D;
  type Node = Parameters<typeof drawNode>[1];

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    vi.clearAllMocks();
  });

  const box = (
    style: Record<string, unknown>,
    children: Node["children"] = [],
    extra: Partial<Node> = {},
  ): Node => ({
    type: "div",
    style,
    children,
    props: {},
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    ...extra,
  });

  const order = (mock: unknown, call = 0) =>
    vi.mocked(mock as () => void).mock.invocationCallOrder[call]!;

  it("paints a translucent element and its children as one group", async () => {
    await drawNode(
      ctx,
      box({ opacity: 0.5, backgroundColor: "red" }, [
        box({ backgroundColor: "blue" }),
      ]),
      0,
      0,
    );

    expect(beginGroup).toHaveBeenCalledTimes(1);
    expect(beginGroup).toHaveBeenCalledWith(ctx, {
      opacity: 0.5,
      filter: undefined,
    });
    // Both fills land inside the group, which fades them together: the
    // opacity is not applied to each draw.
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(order(beginGroup)).toBeLessThan(order(ctx.fillRect, 0));
    expect(order(ctx.fillRect, 1)).toBeLessThan(order(endGroup));
    expect(ctx.globalAlpha).toBe(1);
  });

  it("applies a filter to the group rather than to each draw", async () => {
    await drawNode(
      ctx,
      box({ filter: "drop-shadow(2px 2px 0px red)", backgroundColor: "red" }),
      0,
      0,
    );

    expect(beginGroup).toHaveBeenCalledWith(ctx, {
      opacity: 1,
      filter: "drop-shadow(2px 2px 0px red)",
    });
    expect(endGroup).toHaveBeenCalledTimes(1);
    expect(ctx.filter).toBe("none");
  });

  it("fades text through a group too", async () => {
    await drawNode(
      ctx,
      box({ fontSize: 16, color: "black", opacity: 0.5 }, [], {
        type: "text",
        textContent: "Hello",
      }),
      0,
      0,
    );

    expect(beginGroup).toHaveBeenCalledTimes(1);
    expect(order(beginGroup)).toBeLessThan(order(fillParagraph));
    expect(order(fillParagraph)).toBeLessThan(order(endGroup));
    expect(ctx.globalAlpha).toBe(1);
  });

  it("reads a numeric string as an opacity, as CSS does", async () => {
    await drawNode(ctx, box({ opacity: "0.5", backgroundColor: "red" }), 0, 0);
    expect(beginGroup).toHaveBeenCalledWith(ctx, {
      opacity: 0.5,
      filter: undefined,
    });

    vi.clearAllMocks();
    await drawNode(ctx, box({ opacity: "0", backgroundColor: "red" }), 0, 0);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("nests a group for a translucent child of a translucent parent", async () => {
    await drawNode(
      ctx,
      box({ opacity: 0.5 }, [box({ opacity: 0.25, backgroundColor: "blue" })]),
      0,
      0,
    );

    expect(vi.mocked(beginGroup).mock.calls.map((c) => c[1])).toEqual([
      { opacity: 0.5, filter: undefined },
      { opacity: 0.25, filter: undefined },
    ]);
    expect(endGroup).toHaveBeenCalledTimes(2);
  });

  it.each([
    {},
    { opacity: 1 },
    { opacity: NaN },
    { filter: "none" },
    { filter: " " },
  ])(
    "paints an opaque, unfiltered element without a group: %o",
    async (style) => {
      await drawNode(ctx, box({ ...style, backgroundColor: "red" }), 0, 0);

      expect(ctx.fillRect).toHaveBeenCalled();
      expect(beginGroup).not.toHaveBeenCalled();
      expect(endGroup).not.toHaveBeenCalled();
    },
  );

  it("closes the group and every save when an image inside it fails to load", async () => {
    vi.mocked(loadImage).mockRejectedValueOnce(new Error("no such image"));
    const node = box({ opacity: 0.5, backgroundColor: "red" }, [
      box({}, [], { type: "img", props: { src: "missing.png" } }),
      box({ backgroundColor: "blue" }),
    ]);

    await expect(drawNode(ctx, node, 0, 0)).rejects.toThrow("no such image");

    // Nothing is left open for the next frame drawn on this context.
    expect(beginGroup).toHaveBeenCalledTimes(1);
    expect(endGroup).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ctx.restore).mock.calls).toHaveLength(
      vi.mocked(ctx.save).mock.calls.length,
    );
    // The sibling after the failed image is not painted.
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it("groups a translucent element around a backdrop-filter inside it", async () => {
    // The element's group is the backdrop root of what it contains.
    await drawNode(
      ctx,
      box({ opacity: 0.5 }, [box({ backdropFilter: "blur(2px)" })]),
      0,
      0,
    );

    expect(vi.mocked(beginGroup).mock.calls.map((c) => c[1])).toEqual([
      { opacity: 0.5, filter: undefined },
      { backdropFilter: "blur(2px)", opacity: 1 },
    ]);
  });
});

describe("drawNode – backdrop-filter", () => {
  let ctx: SKRSContext2D;

  beforeEach(() => {
    const canvas = createCanvas(200, 200);
    ctx = canvas.getContext("2d");
    vi.clearAllMocks();
  });

  const order = (mock: unknown, call = 0) =>
    vi.mocked(mock as () => void).mock.invocationCallOrder[call]!;

  it("filters the backdrop in a group clipped to the border box, before the background", async () => {
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

    // A group that starts from the filtered backdrop and holds nothing else.
    expect(beginGroup).toHaveBeenCalledTimes(1);
    expect(beginGroup).toHaveBeenCalledWith(ctx, {
      backdropFilter: "blur(4px)",
      opacity: 1,
    });
    expect(endGroup).toHaveBeenCalledTimes(1);
    // Clipped to the border box, and composited before the background fill.
    expect(ctx.rect).toHaveBeenCalledWith(50, 60, 100, 40);
    expect(order(ctx.clip)).toBeLessThan(order(beginGroup));
    expect(order(beginGroup)).toBeLessThan(order(endGroup));
    expect(order(endGroup)).toBeLessThan(order(ctx.fillRect));
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
    // The shadow must not be part of the backdrop: the backdrop group ends
    // before drawBoxShadow's evenodd clip.
    const clip = vi.mocked(ctx.clip);
    const shadowClip = clip.mock.calls.findIndex(
      (c) => (c as unknown[])[0] === "evenodd",
    );
    expect(shadowClip).toBeGreaterThanOrEqual(0);
    expect(order(endGroup)).toBeLessThan(
      clip.mock.invocationCallOrder[shadowClip]!,
    );
  });

  it("composites the backdrop at the element's opacity, outside its own group", async () => {
    await drawNode(
      ctx,
      {
        type: "div",
        style: {
          backdropFilter: "blur(4px)",
          opacity: 0.5,
          backgroundColor: "red",
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

    expect(vi.mocked(beginGroup).mock.calls.map((c) => c[1])).toEqual([
      { backdropFilter: "blur(4px)", opacity: 0.5 },
      { opacity: 0.5, filter: undefined },
    ]);
    // The backdrop group has ended before the element's group begins.
    expect(order(endGroup, 0)).toBeLessThan(order(beginGroup, 1));
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
    expect(beginGroup).not.toHaveBeenCalled();
  });
});
