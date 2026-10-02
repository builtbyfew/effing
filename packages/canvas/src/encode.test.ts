import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCanvas } from "./index.ts";

// createCanvas() used to patch encode() to copy its result to the JS heap.
// These hold the unpatched encode() to what the copy was there to guarantee.

const SIZE = 256;
const hash = (data: Uint8Array) =>
  createHash("sha1").update(data).digest("hex");
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

function paintFrame(canvas: ReturnType<typeof createCanvas>, frame: number) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = `hsl(${(frame * 37) % 360} 70% 50%)`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, 10 + frame * 2, 0, Math.PI * 2);
  ctx.fill();
}

describe("createCanvas().encode()", () => {
  it("encodes the frame it was called on while the canvas is repainted", async () => {
    const canvas = createCanvas(SIZE, SIZE);
    const expected: string[] = [];
    const pending: Promise<Buffer>[] = [];
    for (let frame = 0; frame < 40; frame++) {
      paintFrame(canvas, frame);
      expected.push(hash(canvas.encodeSync("png")));
      pending.push(canvas.encode("png"));
    }
    const encoded = await Promise.all(pending);
    expect(new Set(expected).size).toBe(expected.length);
    expect(encoded.map(hash)).toEqual(expected);
  });

  it("keeps a buffer intact after its canvas is gone", async () => {
    const expected: string[] = [];
    const pending: Promise<Buffer>[] = [];
    for (let frame = 0; frame < 40; frame++) {
      const canvas = createCanvas(SIZE, SIZE);
      paintFrame(canvas, frame);
      expected.push(hash(canvas.encodeSync("png")));
      pending.push(canvas.encode("png"));
    }
    const encoded = await Promise.all(pending);
    // Churn native memory and give finalizers turns to run, with only the
    // buffers still referenced.
    for (let round = 0; round < 3; round++) {
      for (let frame = 0; frame < 20; frame++) {
        const canvas = createCanvas(SIZE, SIZE);
        paintFrame(canvas, frame);
        canvas.encodeSync("png");
      }
      (globalThis as { gc?: () => void }).gc?.();
      await turn();
    }
    expect(encoded.map(hash)).toEqual(expected);
  });
});
