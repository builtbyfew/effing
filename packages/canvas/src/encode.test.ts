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

/**
 * A minimal QOI decoder (https://qoiformat.org/qoi-specification.pdf), to
 * check encode("qoi") against the pixels that were drawn. Always returns
 * RGBA, as getImageData does.
 */
function decodeQoi(bytes: Uint8Array): {
  width: number;
  height: number;
  channels: number;
  colorspace: number;
  pixels: Uint8Array;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(4);
  const height = view.getUint32(8);
  const channels = bytes[12];
  const colorspace = bytes[13];
  const pixels = new Uint8Array(width * height * 4);
  const index = new Uint8Array(64 * 4);
  let [r, g, b, a] = [0, 0, 0, 255];
  let p = 14;
  let run = 0;
  for (let out = 0; out < pixels.length; out += 4) {
    if (run > 0) {
      run--;
    } else {
      const b1 = bytes[p++];
      if (b1 === 0xfe) {
        [r, g, b] = [bytes[p++], bytes[p++], bytes[p++]];
      } else if (b1 === 0xff) {
        [r, g, b, a] = [bytes[p++], bytes[p++], bytes[p++], bytes[p++]];
      } else if (b1 >> 6 === 0) {
        [r, g, b, a] = index.subarray(b1 * 4, b1 * 4 + 4);
      } else if (b1 >> 6 === 1) {
        r = (r + ((b1 >> 4) & 3) - 2) & 0xff;
        g = (g + ((b1 >> 2) & 3) - 2) & 0xff;
        b = (b + (b1 & 3) - 2) & 0xff;
      } else if (b1 >> 6 === 2) {
        const b2 = bytes[p++];
        const dg = (b1 & 0x3f) - 32;
        r = (r + dg - 8 + ((b2 >> 4) & 0x0f)) & 0xff;
        g = (g + dg) & 0xff;
        b = (b + dg - 8 + (b2 & 0x0f)) & 0xff;
      } else {
        run = b1 & 0x3f;
      }
      const hashIndex = ((r * 3 + g * 5 + b * 7 + a * 11) % 64) * 4;
      index.set([r, g, b, a], hashIndex);
    }
    pixels.set([r, g, b, a], out);
  }
  // The end marker: seven 0x00 bytes and a 0x01.
  expect([...bytes.subarray(p)]).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  return { width, height, channels, colorspace, pixels };
}

describe('createCanvas().encode("qoi")', () => {
  // Not square, so a swapped width and height would show.
  const WIDTH = 96;
  const HEIGHT = 40;

  function paintQoiFrame(canvas: ReturnType<typeof createCanvas>) {
    const ctx = canvas.getContext("2d");
    // An opaque gradient (QOI's diff ops), a flat block (runs), a
    // half-transparent block and a fully transparent corner.
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
    gradient.addColorStop(0, "#ff4000");
    gradient.addColorStop(1, "#0040ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT / 2);
    ctx.fillStyle = "#20c060";
    ctx.fillRect(0, HEIGHT / 2, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = "rgba(200, 30, 90, 0.5)";
    ctx.fillRect(WIDTH / 2, HEIGHT / 2, WIDTH / 4, HEIGHT / 2);
  }

  it("writes a QOI header with the canvas size and four channels", async () => {
    const canvas = createCanvas(WIDTH, HEIGHT);
    paintQoiFrame(canvas);
    const qoi = await canvas.encode("qoi");
    expect(qoi.subarray(0, 4).toString("latin1")).toBe("qoif");
    expect(qoi.readUInt32BE(4)).toBe(WIDTH);
    expect(qoi.readUInt32BE(8)).toBe(HEIGHT);
    // RGBA, sRGB with linear alpha
    expect(qoi[12]).toBe(4);
    expect(qoi[13]).toBe(0);
  });

  it("round-trips the canvas pixels losslessly, with straight alpha", async () => {
    const canvas = createCanvas(WIDTH, HEIGHT);
    paintQoiFrame(canvas);
    const expected = canvas
      .getContext("2d")
      .getImageData(0, 0, WIDTH, HEIGHT).data;
    for (const qoi of [await canvas.encode("qoi"), canvas.encodeSync("qoi")]) {
      const decoded = decodeQoi(qoi);
      expect([decoded.width, decoded.height]).toEqual([WIDTH, HEIGHT]);
      expect(Buffer.from(decoded.pixels).equals(Buffer.from(expected))).toBe(
        true,
      );
    }
    // Spot-check the half-transparent block and the transparent corner.
    const at = (x: number, y: number) =>
      Array.from(
        expected.subarray((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 4),
      );
    const [r, g, b, a] = at(WIDTH / 2 + 4, HEIGHT - 4);
    expect(a).toBeGreaterThan(120);
    expect(a).toBeLessThan(135);
    expect(Math.abs(r - 200)).toBeLessThanOrEqual(2);
    expect(Math.abs(g - 30)).toBeLessThanOrEqual(2);
    expect(Math.abs(b - 90)).toBeLessThanOrEqual(2);
    expect(at(WIDTH - 2, HEIGHT - 2)).toEqual([0, 0, 0, 0]);
  });

  it("is also available as image/qoi via toBuffer", () => {
    const canvas = createCanvas(WIDTH, HEIGHT);
    paintQoiFrame(canvas);
    expect(canvas.toBuffer("image/qoi").equals(canvas.encodeSync("qoi"))).toBe(
      true,
    );
  });
});
