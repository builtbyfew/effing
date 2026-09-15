import { describe, expect, it } from "vitest";

import { parseClipPath, type ClipShape } from "./clip-path.ts";

const box = { x: 10, y: 20, width: 200, height: 100 };

function parse(value: string, style = {}): ClipShape | null {
  return parseClipPath(value, style, box);
}

describe("parseClipPath – keywords", () => {
  it("parses none", () => {
    expect(parse("none")).toEqual({ kind: "none" });
  });

  it("returns null for unsupported values", () => {
    expect(parse("url(#clip)")).toBeNull();
    expect(parse("hexagon(1 2)")).toBeNull();
    expect(parse("")).toBeNull();
  });

  it("clips to a bare geometry box", () => {
    expect(parse("border-box")).toEqual({
      kind: "rect",
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      radii: null,
    });
    expect(
      parse("padding-box", { borderTopWidth: 4, borderLeftWidth: 6 }),
    ).toEqual({
      kind: "rect",
      x: 16,
      y: 24,
      width: 194,
      height: 96,
      radii: null,
    });
    expect(
      parse("content-box", {
        borderTopWidth: 4,
        paddingTop: 6,
        paddingLeft: 8,
      }),
    ).toEqual({
      kind: "rect",
      x: 18,
      y: 30,
      width: 192,
      height: 90,
      radii: null,
    });
    expect(parse("margin-box", { marginLeft: 5, marginBottom: 7 })).toEqual({
      kind: "rect",
      x: 5,
      y: 20,
      width: 205,
      height: 107,
      radii: null,
    });
  });

  it("follows the border radius for a bare geometry box", () => {
    const shape = parse("border-box", { borderTopLeftRadius: 20 });
    expect(shape).toMatchObject({
      kind: "rect",
      radii: [
        [20, 20],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    });
    // Inner boxes shrink the radius by the border width.
    const inner = parse("padding-box", {
      borderTopLeftRadius: 20,
      borderTopWidth: 5,
      borderLeftWidth: 5,
    });
    expect(inner).toMatchObject({
      kind: "rect",
      x: 15,
      y: 25,
      radii: [
        [15, 15],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    });
  });
});

describe("parseClipPath – inset / rect / xywh", () => {
  it("parses inset with 1–4 values and percentages", () => {
    expect(parse("inset(10px)")).toEqual({
      kind: "rect",
      x: 20,
      y: 30,
      width: 180,
      height: 80,
      radii: null,
    });
    expect(parse("inset(10% 20%)")).toEqual({
      kind: "rect",
      x: 50,
      y: 30,
      width: 120,
      height: 80,
      radii: null,
    });
    expect(parse("inset(1px 2px 3px 4px)")).toEqual({
      kind: "rect",
      x: 14,
      y: 21,
      width: 194,
      height: 96,
      radii: null,
    });
  });

  it("parses inset with round radii", () => {
    expect(parse("inset(0 round 10px)")).toMatchObject({
      kind: "rect",
      radii: [
        [10, 10],
        [10, 10],
        [10, 10],
        [10, 10],
      ],
    });
    expect(parse("inset(0 round 10px 20px / 5px)")).toMatchObject({
      radii: [
        [10, 5],
        [20, 5],
        [10, 5],
        [20, 5],
      ],
    });
    // Percentages in `round` resolve against the inset rectangle.
    expect(parse("inset(0 50px round 10%)")).toMatchObject({
      width: 100,
      height: 100,
      radii: [
        [10, 10],
        [10, 10],
        [10, 10],
        [10, 10],
      ],
    });
  });

  it("scales overlapping radii down like border-radius", () => {
    // 100px wide box, two 80px corners along the top → factor 100/160.
    const shape = parse("inset(0 50px round 80px 80px 0 0)");
    expect(shape).toMatchObject({ width: 100 });
    expect((shape as { radii: number[][] }).radii[0]).toEqual([50, 50]);
    expect((shape as { radii: number[][] }).radii[1]).toEqual([50, 50]);
  });

  it("clamps negative sizes to zero", () => {
    expect(parse("inset(60% 0)")).toMatchObject({ width: 200, height: 0 });
  });

  it("parses rect() with auto edges", () => {
    expect(parse("rect(10px 150px auto 30px)")).toEqual({
      kind: "rect",
      x: 40,
      y: 30,
      width: 120,
      height: 90,
      radii: null,
    });
    expect(parse("rect(auto auto auto auto)")).toMatchObject({
      x: 10,
      y: 20,
      width: 200,
      height: 100,
    });
  });

  it("parses xywh()", () => {
    expect(parse("xywh(10% 10px 50% 50%)")).toEqual({
      kind: "rect",
      x: 30,
      y: 30,
      width: 100,
      height: 50,
      radii: null,
    });
  });

  it("rejects malformed values", () => {
    expect(parse("inset()")).toBeNull();
    expect(parse("inset(1 2 3 4 5)")).toBeNull();
    expect(parse("inset(abc)")).toBeNull();
    expect(parse("rect(1 2 3)")).toBeNull();
    expect(parse("xywh(1 2 3)")).toBeNull();
  });
});

describe("parseClipPath – circle / ellipse", () => {
  it("defaults to closest-side at the center", () => {
    expect(parse("circle()")).toEqual({
      kind: "circle",
      cx: 110,
      cy: 70,
      r: 50,
    });
    expect(parse("circle(closest-side)")).toMatchObject({ r: 50 });
    expect(parse("circle(farthest-side)")).toMatchObject({ r: 100 });
  });

  it("resolves circle percentages against the diagonal / sqrt(2)", () => {
    const base = Math.hypot(200, 100) / Math.SQRT2;
    expect(parse("circle(50%)")).toMatchObject({ r: base / 2 });
  });

  it("resolves positions after `at`", () => {
    expect(parse("circle(10px at 0 0)")).toMatchObject({ cx: 10, cy: 20 });
    expect(parse("circle(10px at left)")).toMatchObject({ cx: 10, cy: 70 });
    expect(parse("circle(10px at top)")).toMatchObject({ cx: 110, cy: 20 });
    expect(parse("circle(10px at bottom right)")).toMatchObject({
      cx: 210,
      cy: 120,
    });
    expect(parse("circle(10px at 25% 75%)")).toMatchObject({ cx: 60, cy: 95 });
    expect(parse("circle(10px at right 10px bottom 20px)")).toMatchObject({
      cx: 200,
      cy: 100,
    });
    expect(parse("circle(10px at 30px)")).toMatchObject({ cx: 40, cy: 70 });
  });

  it("uses closest/farthest side per axis for ellipses", () => {
    expect(parse("ellipse()")).toEqual({
      kind: "ellipse",
      cx: 110,
      cy: 70,
      rx: 100,
      ry: 50,
    });
    expect(parse("ellipse(farthest-side closest-side at 25% 25%)")).toEqual({
      kind: "ellipse",
      cx: 60,
      cy: 45,
      rx: 150,
      ry: 25,
    });
    expect(parse("ellipse(50% 25%)")).toMatchObject({ rx: 100, ry: 25 });
  });

  it("rejects malformed values", () => {
    expect(parse("circle(1 2)")).toBeNull();
    expect(parse("circle(10px at nowhere)")).toBeNull();
    expect(parse("ellipse(10px)")).toBeNull();
  });
});

describe("parseClipPath – polygon / path", () => {
  it("parses polygon points with percentages", () => {
    expect(parse("polygon(50% 0, 100% 100%, 0 100%)")).toEqual({
      kind: "polygon",
      fillRule: "nonzero",
      points: [
        [110, 20],
        [210, 120],
        [10, 120],
      ],
    });
  });

  it("accepts a leading fill rule", () => {
    expect(parse("polygon(evenodd, 0 0, 10px 0, 10px 10px)")).toMatchObject({
      fillRule: "evenodd",
      points: [
        [10, 20],
        [20, 20],
        [20, 30],
      ],
    });
  });

  it("parses path() with a quoted string and offsets it to the box", () => {
    expect(parse('path("M0 0 L10,10 Z")')).toEqual({
      kind: "path",
      d: "M0 0 L10,10 Z",
      dx: 10,
      dy: 20,
      fillRule: "nonzero",
    });
    expect(parse("path(evenodd, 'M0 0 H10 V10 Z')")).toMatchObject({
      d: "M0 0 H10 V10 Z",
      fillRule: "evenodd",
    });
  });

  it("rejects malformed values", () => {
    expect(parse("polygon(0 0 0, 1 1)")).toBeNull();
    expect(parse("polygon()")).toBeNull();
    expect(parse('path("M0 0", "M1 1")')).toBeNull();
  });
});

describe("parseClipPath – shape()", () => {
  it("builds absolute path data from to/by commands", () => {
    const shape = parse(
      "shape(from 0 0, line to 100% 0, line by 0 50%, hline to 0, vline by -25%, close)",
    );
    expect(shape).toEqual({
      kind: "path",
      d: "M0 0 L200 0 L200 50 H0 V25 Z",
      dx: 10,
      dy: 20,
      fillRule: "nonzero",
    });
  });

  it("supports position keywords", () => {
    expect(
      parse("shape(from left top, line to center center, hline to right)"),
    ).toMatchObject({ d: "M0 0 L100 50 H200" });
  });

  it("maps curve and smooth commands to Q/C/T/S", () => {
    expect(
      parse(
        "shape(from 0 0, curve to 100px 0 with 50px 20px, curve to 100px 100px with 120px 20px / 120px 80px, smooth to 0 100px, smooth to 0 0 with 10px 50px)",
      ),
    ).toMatchObject({
      d: "M0 0 Q50 20 100 0 C120 20 120 80 100 100 T0 100 S10 50 0 0",
    });
  });

  it("resolves control points relative to the segment for `by`", () => {
    expect(
      parse("shape(from 10px 10px, curve by 20px 0 with 10px -10px)"),
    ).toMatchObject({ d: "M10 10 Q20 0 30 10" });
    expect(
      parse(
        "shape(from 10px 10px, curve to 30px 10px with 10px -10px from start)",
      ),
    ).toMatchObject({ d: "M10 10 Q20 0 30 10" });
    expect(
      parse(
        "shape(from 10px 10px, curve to 30px 10px with -10px -10px from end)",
      ),
    ).toMatchObject({ d: "M10 10 Q20 0 30 10" });
  });

  it("maps arc commands to SVG arcs", () => {
    expect(
      parse(
        "shape(from 0 50%, arc to 100% 50% of 50% 50% cw large rotate 90deg)",
      ),
    ).toMatchObject({ d: "M0 50 A100 50 90 1 1 200 50" });
    expect(parse("shape(from 0 0, arc by 10px 10px of 10px)")).toMatchObject({
      d: "M0 0 A10 10 0 0 0 10 10",
    });
  });

  it("accepts a leading fill rule", () => {
    expect(parse("shape(evenodd from 0 0, line to 1px 1px)")).toMatchObject({
      fillRule: "evenodd",
    });
  });

  it("rejects malformed values", () => {
    expect(parse("shape(0 0, line to 1 1)")).toBeNull();
    expect(parse("shape(from 0 0, line 1 1)")).toBeNull();
    expect(parse("shape(from 0 0, curve to 1 1)")).toBeNull();
    expect(parse("shape(from 0 0, wiggle to 1 1)")).toBeNull();
    expect(parse("shape(from 0 0, arc to 1 1 of)")).toBeNull();
  });
});

describe("parseClipPath – geometry box with a shape", () => {
  it("resolves the shape against the chosen box, in either order", () => {
    const style = { paddingTop: 10, paddingLeft: 10 };
    expect(parse("circle(10px at 0 0) content-box", style)).toMatchObject({
      cx: 20,
      cy: 30,
    });
    expect(parse("content-box circle(10px at 0 0)", style)).toMatchObject({
      cx: 20,
      cy: 30,
    });
  });

  it("rejects unknown keywords next to a shape", () => {
    expect(parse("circle(10px) nope")).toBeNull();
  });
});
