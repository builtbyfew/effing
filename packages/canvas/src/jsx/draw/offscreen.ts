import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import { createCanvas } from "@napi-rs/canvas";

const canvasPool = new Map<string, WeakRef<Canvas>[]>();

export function acquireOffscreen(
  w: number,
  h: number,
): [Canvas, SKRSContext2D] {
  const key = `${w}x${h}`;
  const stack = canvasPool.get(key);
  if (stack) {
    while (stack.length > 0) {
      const ref = stack.pop()!;
      const canvas = ref.deref();
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.reset();
        return [canvas, ctx];
      }
    }
  }
  const canvas = createCanvas(w, h);
  return [canvas, canvas.getContext("2d")];
}

export function releaseOffscreen(canvas: Canvas): void {
  const key = `${canvas.width}x${canvas.height}`;
  let stack = canvasPool.get(key);
  if (!stack) {
    stack = [];
    canvasPool.set(key, stack);
  }
  stack.push(new WeakRef(canvas));
}
