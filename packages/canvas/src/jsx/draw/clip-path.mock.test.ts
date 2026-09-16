import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@napi-rs/canvas", async () => {
  const { createCanvasMock } = await import("../../canvas-mock.ts");
  return createCanvasMock();
});

import { Path2D } from "@napi-rs/canvas";
import { clipShapeToPath } from "./clip-path.ts";

type MockPath = {
  rect: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  ellipse: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  addPath: ReturnType<typeof vi.fn>;
};

const MockPath2D = vi.mocked(Path2D);

describe("clipShapeToPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a plain rect", () => {
    const p = clipShapeToPath({
      kind: "rect",
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      radii: null,
    }) as unknown as MockPath;
    expect(p.rect).toHaveBeenCalledWith(1, 2, 3, 4);
  });

  it("builds a rounded rect from per-corner elliptical radii", () => {
    const p = clipShapeToPath({
      kind: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      radii: [
        [10, 5],
        [0, 0],
        [20, 20],
        [0, 0],
      ],
    }) as unknown as MockPath;
    expect(p.moveTo).toHaveBeenCalledWith(10, 0);
    // Square top-right corner: straight lines through the corner.
    expect(p.lineTo).toHaveBeenCalledWith(100, 0);
    expect(p.lineTo).toHaveBeenCalledWith(100, 30);
    // Bottom-right and top-left corners are elliptical arcs.
    expect(p.ellipse).toHaveBeenCalledWith(80, 30, 20, 20, 0, 0, Math.PI / 2);
    expect(p.ellipse).toHaveBeenCalledWith(
      10,
      5,
      10,
      5,
      0,
      Math.PI,
      (3 * Math.PI) / 2,
    );
    expect(p.ellipse).toHaveBeenCalledTimes(2);
    expect(p.closePath).toHaveBeenCalled();
  });

  it("builds circles and ellipses", () => {
    const c = clipShapeToPath({
      kind: "circle",
      cx: 5,
      cy: 6,
      r: 7,
    }) as unknown as MockPath;
    expect(c.arc).toHaveBeenCalledWith(5, 6, 7, 0, Math.PI * 2);

    const e = clipShapeToPath({
      kind: "ellipse",
      cx: 5,
      cy: 6,
      rx: 7,
      ry: 8,
    }) as unknown as MockPath;
    expect(e.ellipse).toHaveBeenCalledWith(5, 6, 7, 8, 0, 0, Math.PI * 2);
  });

  it("leaves the path empty for a zero-radius circle (clips everything)", () => {
    const c = clipShapeToPath({
      kind: "circle",
      cx: 5,
      cy: 6,
      r: 0,
    }) as unknown as MockPath;
    expect(c.arc).not.toHaveBeenCalled();
    expect(c.rect).not.toHaveBeenCalled();
  });

  it("builds polygons", () => {
    const p = clipShapeToPath({
      kind: "polygon",
      fillRule: "nonzero",
      points: [
        [0, 0],
        [10, 0],
        [5, 10],
      ],
    }) as unknown as MockPath;
    expect(p.moveTo).toHaveBeenCalledWith(0, 0);
    expect(p.lineTo).toHaveBeenNthCalledWith(1, 10, 0);
    expect(p.lineTo).toHaveBeenNthCalledWith(2, 5, 10);
    expect(p.closePath).toHaveBeenCalled();
  });

  it("parses path data and offsets it to the reference box", () => {
    clipShapeToPath({
      kind: "path",
      d: "M0 0 L10 10",
      dx: 30,
      dy: 40,
      fillRule: "nonzero",
    });
    expect(MockPath2D).toHaveBeenCalledWith("M0 0 L10 10");
    // The outer (translated) path is created first, the parsed one second.
    const outer = MockPath2D.mock.results[0]!.value as MockPath;
    expect(outer.addPath).toHaveBeenCalledWith(expect.anything(), {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 30,
      f: 40,
    });
  });
});
