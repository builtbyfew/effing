import type { Canvas } from "@napi-rs/canvas";

import type { SvgChild } from "./types.ts";
import { normalizeChildren } from "./tree.ts";
import { acquireOffscreen } from "../offscreen.ts";

function applyFeOffset(
  input: Canvas,
  dx: number,
  dy: number,
  w: number,
  h: number,
): Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.drawImage(input, dx, dy);
  return canvas;
}

function applyFeGaussianBlur(
  input: Canvas,
  stdDeviation: number,
  w: number,
  h: number,
): Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.filter = `blur(${stdDeviation}px)`;
  ctx.drawImage(input, 0, 0);
  ctx.filter = "none";
  return canvas;
}

function applyFeColorMatrix(
  input: Canvas,
  type: string,
  values: string | undefined,
  w: number,
  h: number,
): Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.drawImage(input, 0, 0);

  if (type === "matrix" && values) {
    const m = values
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (m.length >= 20) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const a = d[i + 3]!;
        d[i] = Math.min(
          255,
          Math.max(
            0,
            m[0]! * r + m[1]! * g + m[2]! * b + m[3]! * a + m[4]! * 255,
          ),
        );
        d[i + 1] = Math.min(
          255,
          Math.max(
            0,
            m[5]! * r + m[6]! * g + m[7]! * b + m[8]! * a + m[9]! * 255,
          ),
        );
        d[i + 2] = Math.min(
          255,
          Math.max(
            0,
            m[10]! * r + m[11]! * g + m[12]! * b + m[13]! * a + m[14]! * 255,
          ),
        );
        d[i + 3] = Math.min(
          255,
          Math.max(
            0,
            m[15]! * r + m[16]! * g + m[17]! * b + m[18]! * a + m[19]! * 255,
          ),
        );
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  return canvas;
}

const BLEND_MODE_MAP: Record<string, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  darken: "darken",
  lighten: "lighten",
  overlay: "overlay",
};

function applyFeBlend(
  in1: Canvas,
  in2: Canvas,
  mode: string,
  w: number,
  h: number,
): Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.drawImage(in2, 0, 0);
  ctx.globalCompositeOperation = BLEND_MODE_MAP[mode] ?? "source-over";
  ctx.drawImage(in1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/**
 * Extract the alpha channel of a canvas as a new greyscale canvas.
 * The result is a canvas where each pixel's RGBA channels equal the
 * source alpha (i.e. white where opaque, black where transparent).
 */
function extractSourceAlpha(input: Canvas, w: number, h: number): Canvas {
  const [canvas, ctx] = acquireOffscreen(w, h);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(input, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/**
 * Execute an SVG `<filter>` pipeline on the element canvas.
 * Returns a new canvas with the filtered result; the caller is responsible
 * for releasing all canvases.
 */
export function applyFilter(
  filterDef: SvgChild,
  sourceGraphic: Canvas,
  w: number,
  h: number,
): Canvas {
  const buffers = new Map<string, Canvas>();
  buffers.set("SourceGraphic", sourceGraphic);

  let sourceAlpha: Canvas | undefined;
  const getSourceAlpha = () => {
    if (!sourceAlpha) {
      sourceAlpha = extractSourceAlpha(sourceGraphic, w, h);
      buffers.set("SourceAlpha", sourceAlpha);
    }
    return sourceAlpha;
  };

  const children = normalizeChildren(filterDef);
  let lastResult: Canvas = sourceGraphic;

  for (const prim of children) {
    const p = prim.props;
    const inName = (p.in as string | undefined) ?? "";
    const resolve = (name: string): Canvas => {
      if (name === "SourceAlpha") return getSourceAlpha();
      return buffers.get(name) ?? lastResult;
    };
    const input = inName ? resolve(inName) : lastResult;
    let output: Canvas;

    switch (prim.type) {
      case "feOffset":
        output = applyFeOffset(
          input,
          Number(p.dx ?? 0),
          Number(p.dy ?? 0),
          w,
          h,
        );
        break;
      case "feGaussianBlur": {
        const std = Number(p.stdDeviation ?? 0);
        output = std > 0 ? applyFeGaussianBlur(input, std, w, h) : input;
        break;
      }
      case "feColorMatrix":
        output = applyFeColorMatrix(
          input,
          (p.type as string) ?? "matrix",
          p.values as string | undefined,
          w,
          h,
        );
        break;
      case "feBlend": {
        const in2Name = (p.in2 as string | undefined) ?? "";
        const in2 = in2Name ? resolve(in2Name) : lastResult;
        output = applyFeBlend(input, in2, (p.mode as string) ?? "normal", w, h);
        break;
      }
      default:
        output = input;
        break;
    }

    const resultName = p.result as string | undefined;
    if (resultName) buffers.set(resultName, output);
    lastResult = output;
  }

  return lastResult;
}
