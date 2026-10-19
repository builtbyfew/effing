import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pathToFFmpeg } from "@effing/ffmpeg";
import { describe, expect, it } from "vitest";
import { QOI_MAX_PIXELS, decodeQoi, isQoi, readQoiHeader } from "./qoi";

// --- Hand-built QOI streams --------------------------------------------------

type Rgba = [number, number, number, number];

const END_MARKER = [0, 0, 0, 0, 0, 0, 0, 1];

function header(
  width: number,
  height: number,
  channels = 4,
  colorspace = 0,
): number[] {
  return [
    0x71, // q
    0x6f, // o
    0x69, // i
    0x66, // f
    (width >>> 24) & 0xff,
    (width >>> 16) & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    (height >>> 24) & 0xff,
    (height >>> 16) & 0xff,
    (height >>> 8) & 0xff,
    height & 0xff,
    channels,
    colorspace,
  ];
}

function qoi(
  width: number,
  height: number,
  ops: number[][],
  { channels = 4, colorspace = 0 } = {},
): Uint8Array {
  return new Uint8Array([
    ...header(width, height, channels, colorspace),
    ...ops.flat(),
    ...END_MARKER,
  ]);
}

const op = {
  rgb: (r: number, g: number, b: number) => [0xfe, r, g, b],
  rgba: (r: number, g: number, b: number, a: number) => [0xff, r, g, b, a],
  index: (i: number) => [i],
  /** Differences in -2..1 */
  diff: (dr: number, dg: number, db: number) => [
    0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2),
  ],
  /** dg in -32..31; dr - dg and db - dg in -8..7 */
  luma: (dg: number, drDg: number, dbDg: number) => [
    0x80 | (dg + 32),
    ((drDg + 8) << 4) | (dbDg + 8),
  ],
  /** Run length in 1..62 */
  run: (length: number) => [0xc0 | (length - 1)],
};

function hash([r, g, b, a]: Rgba): number {
  return (r * 3 + g * 5 + b * 7 + a * 11) % 64;
}

function pixelsOf(data: Uint8ClampedArray): Rgba[] {
  const out: Rgba[] = [];
  for (let i = 0; i < data.length; i += 4) {
    out.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
  }
  return out;
}

function decodePixels(bytes: Uint8Array): Rgba[] {
  return pixelsOf(decodeQoi(bytes).data);
}

describe("isQoi", () => {
  it("recognises the qoif magic", () => {
    expect(isQoi(qoi(1, 1, [op.run(1)]))).toBe(true);
    expect(isQoi(new Uint8Array([0x71, 0x6f, 0x69, 0x66]))).toBe(true);
  });

  it("rejects other data", () => {
    expect(isQoi(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(isQoi(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false); // JPEG
    expect(isQoi(new Uint8Array([0x71, 0x6f, 0x69]))).toBe(false);
    expect(isQoi(new Uint8Array(0))).toBe(false);
  });
});

describe("decodeQoi", () => {
  describe("ops", () => {
    it("decodes QOI_OP_RGB, keeping the previous alpha", () => {
      expect(
        decodePixels(qoi(2, 1, [op.rgb(10, 20, 30), op.rgb(255, 0, 128)])),
      ).toEqual([
        [10, 20, 30, 255],
        [255, 0, 128, 255],
      ]);
    });

    it("decodes QOI_OP_RGBA, and QOI_OP_RGB after it keeps its alpha", () => {
      expect(
        decodePixels(
          qoi(3, 1, [
            op.rgba(1, 2, 3, 4),
            op.rgb(5, 6, 7),
            op.rgba(0, 0, 0, 0),
          ]),
        ),
      ).toEqual([
        [1, 2, 3, 4],
        [5, 6, 7, 4],
        [0, 0, 0, 0],
      ]);
    });

    it("decodes QOI_OP_INDEX from the pixels seen so far", () => {
      const a: Rgba = [10, 20, 30, 255];
      const b: Rgba = [200, 100, 50, 128];
      expect(hash(a)).not.toBe(hash(b));
      expect(
        decodePixels(
          qoi(4, 1, [
            op.rgb(10, 20, 30),
            op.rgba(200, 100, 50, 128),
            op.index(hash(a)),
            op.index(hash(b)),
          ]),
        ),
      ).toEqual([a, b, a, b]);
    });

    it("decodes an index hit on the initial, all-zero index", () => {
      // Transparent black hashes to 0, where the zeroed index already holds
      // it, so an encoder may open with QOI_OP_INDEX 0.
      expect(decodePixels(qoi(2, 1, [op.index(0), op.rgb(1, 1, 1)]))).toEqual([
        [0, 0, 0, 0],
        [1, 1, 1, 0],
      ]);
    });

    it("indexes the initial pixel when a run of it starts the image", () => {
      // The initial pixel (0, 0, 0, 255) isn't in the index until a run of
      // it stores it, at hash 53.
      const initial: Rgba = [0, 0, 0, 255];
      expect(hash(initial)).toBe(53);
      expect(
        decodePixels(qoi(3, 1, [op.run(1), op.rgb(9, 9, 9), op.index(53)])),
      ).toEqual([initial, [9, 9, 9, 255], initial]);
    });

    it("decodes QOI_OP_DIFF at every extreme, wrapping around", () => {
      expect(
        decodePixels(
          qoi(4, 1, [
            op.diff(-2, -1, 1), // from (0, 0, 0): wraps to (254, 255, 1)
            op.diff(1, 1, -2), // (255, 0, 255)
            op.diff(1, 0, 1), // (0, 0, 0)
            op.diff(0, 0, 0),
          ]),
        ),
      ).toEqual([
        [254, 255, 1, 255],
        [255, 0, 255, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
      ]);
    });

    it("decodes QOI_OP_LUMA at every extreme, wrapping around", () => {
      expect(
        decodePixels(
          qoi(3, 1, [
            op.rgb(100, 100, 100),
            op.luma(-32, -8, 7), // g 68, r 60, b 75
            op.luma(31, 7, -8), // g 99, r 98, b 98
          ]),
        ),
      ).toEqual([
        [100, 100, 100, 255],
        [60, 68, 75, 255],
        [98, 99, 98, 255],
      ]);
      expect(
        decodePixels(
          qoi(1, 1, [
            op.luma(-32, -8, 7), // from (0, 0, 0): (216, 224, 231)
          ]),
        ),
      ).toEqual([[216, 224, 231, 255]]);
    });

    it("decodes QOI_OP_RUN of the initial pixel", () => {
      expect(decodePixels(qoi(3, 1, [op.run(3)]))).toEqual([
        [0, 0, 0, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
      ]);
    });

    it("decodes runs of 1 and of 62", () => {
      const pixels = decodePixels(
        qoi(65, 1, [op.rgb(7, 8, 9), op.run(1), op.rgb(1, 2, 3), op.run(62)]),
      );
      expect(pixels.slice(0, 2)).toEqual([
        [7, 8, 9, 255],
        [7, 8, 9, 255],
      ]);
      expect(pixels.slice(2)).toEqual(
        Array.from({ length: 63 }, () => [1, 2, 3, 255]),
      );
    });

    it("decodes consecutive runs longer than 62 in total", () => {
      const pixels = decodePixels(
        qoi(200, 1, [
          op.rgba(4, 5, 6, 7),
          op.run(62),
          op.run(62),
          op.run(62),
          op.run(13),
        ]),
      );
      expect(pixels).toHaveLength(200);
      expect(pixels.every((p) => p.join() === "4,5,6,7")).toBe(true);
    });

    it("decodes runs that cross rows", () => {
      expect(
        decodePixels(qoi(2, 3, [op.rgb(1, 1, 1), op.run(4), op.rgb(2, 2, 2)])),
      ).toEqual([
        [1, 1, 1, 255],
        [1, 1, 1, 255],
        [1, 1, 1, 255],
        [1, 1, 1, 255],
        [1, 1, 1, 255],
        [2, 2, 2, 255],
      ]);
    });

    it("cuts short a run past the last pixel", () => {
      expect(decodePixels(qoi(2, 1, [op.rgb(3, 3, 3), op.run(62)]))).toEqual([
        [3, 3, 3, 255],
        [3, 3, 3, 255],
      ]);
    });

    it("decodes a mix of every op", () => {
      const pixels = decodePixels(
        qoi(8, 1, [
          op.rgb(50, 60, 70),
          op.diff(1, -1, 0),
          op.luma(10, 2, -3),
          op.rgba(50, 60, 70, 200),
          op.index(hash([50, 60, 70, 255])),
          op.run(2),
          op.index(hash([50, 60, 70, 200])),
        ]),
      );
      expect(pixels).toEqual([
        [50, 60, 70, 255],
        [51, 59, 70, 255],
        [63, 69, 77, 255],
        [50, 60, 70, 200],
        [50, 60, 70, 255],
        [50, 60, 70, 255],
        [50, 60, 70, 255],
        [50, 60, 70, 200],
      ]);
    });
  });

  describe("channels and colorspace", () => {
    it("decodes a 3-channel image to opaque RGBA", () => {
      const image = decodeQoi(
        qoi(2, 2, [op.rgb(1, 2, 3), op.diff(1, 1, 1), op.run(2)], {
          channels: 3,
        }),
      );
      expect(image.channels).toBe(3);
      expect(image.data).toHaveLength(16);
      expect(pixelsOf(image.data)).toEqual([
        [1, 2, 3, 255],
        [2, 3, 4, 255],
        [2, 3, 4, 255],
        [2, 3, 4, 255],
      ]);
    });

    it("reports a 4-channel image's channels", () => {
      const image = decodeQoi(qoi(1, 1, [op.rgba(1, 2, 3, 4)]));
      expect(image.channels).toBe(4);
      expect(pixelsOf(image.data)).toEqual([[1, 2, 3, 4]]);
    });

    it("reports the colorspace without applying it", () => {
      const srgb = decodeQoi(qoi(1, 1, [op.rgb(9, 9, 9)], { colorspace: 0 }));
      const linear = decodeQoi(qoi(1, 1, [op.rgb(9, 9, 9)], { colorspace: 1 }));
      expect(srgb.colorspace).toBe(0);
      expect(linear.colorspace).toBe(1);
      expect(linear.data).toEqual(srgb.data);
    });
  });

  describe("output buffer", () => {
    it("decodes into a given buffer", () => {
      const output = new Uint8ClampedArray(8).fill(77);
      const image = decodeQoi(
        qoi(2, 1, [op.rgb(1, 2, 3), op.rgba(4, 5, 6, 7)]),
        output,
      );
      expect(image.data).toBe(output);
      expect([...output]).toEqual([1, 2, 3, 255, 4, 5, 6, 7]);
    });

    it("decodes into a view at an aligned offset", () => {
      const backing = new Uint8ClampedArray(16).fill(77);
      const output = backing.subarray(4, 12);
      decodeQoi(qoi(2, 1, [op.rgb(1, 2, 3), op.run(1)]), output);
      expect([...backing]).toEqual([
        77, 77, 77, 77, 1, 2, 3, 255, 1, 2, 3, 255, 77, 77, 77, 77,
      ]);
    });

    it("rejects a buffer of the wrong size", () => {
      expect(() =>
        decodeQoi(qoi(2, 1, [op.run(2)]), new Uint8ClampedArray(12)),
      ).toThrow("QOI output buffer holds 12 bytes, expected 8");
    });

    it("rejects a misaligned buffer", () => {
      const output = new Uint8ClampedArray(9).subarray(1);
      expect(() => decodeQoi(qoi(2, 1, [op.run(2)]), output)).toThrow(
        "multiple of 4",
      );
    });
  });

  describe("invalid input", () => {
    it("rejects data without the magic", () => {
      const bytes = qoi(1, 1, [op.run(1)]);
      bytes[0] = 0x51;
      expect(() => decodeQoi(bytes)).toThrow("missing qoif magic");
    });

    it("rejects a header without room for the end marker", () => {
      expect(() => decodeQoi(new Uint8Array(header(1, 1)))).toThrow(
        "data is truncated",
      );
    });

    it("rejects a zero width or height", () => {
      expect(() => decodeQoi(qoi(0, 1, [op.run(1)]))).toThrow("size is 0×1");
      expect(() => decodeQoi(qoi(1, 0, [op.run(1)]))).toThrow("size is 1×0");
    });

    it("rejects channels other than 3 or 4", () => {
      expect(() => decodeQoi(qoi(1, 1, [op.run(1)], { channels: 2 }))).toThrow(
        "2 channels",
      );
      expect(() => decodeQoi(qoi(1, 1, [op.run(1)], { channels: 5 }))).toThrow(
        "5 channels",
      );
    });

    it("rejects a colorspace other than 0 or 1", () => {
      expect(() =>
        decodeQoi(qoi(1, 1, [op.run(1)], { colorspace: 2 })),
      ).toThrow("colorspace 2");
    });

    it("rejects an image larger than QOI_MAX_PIXELS", () => {
      expect(QOI_MAX_PIXELS).toBe(8192 * 8192);
      expect(() => decodeQoi(qoi(8193, 8192, [op.run(1)]))).toThrow(
        "too large",
      );
      expect(() => decodeQoi(qoi(0xffffffff, 0xffffffff, [op.run(1)]))).toThrow(
        "too large",
      );
    });

    it("rejects a header that claims more pixels than the data can hold, before allocating", () => {
      // 8192 × 8192 is within bounds, but even all-run chunks would take
      // over a megabyte to describe it.
      expect(() =>
        readQoiHeader(qoi(8192, 8192, [op.run(62), op.run(62)])),
      ).toThrow("data is truncated");
      // The smallest possible encoding of 124 pixels: two maximal runs.
      expect(readQoiHeader(qoi(124, 1, [op.run(62), op.run(62)]))).toEqual({
        width: 124,
        height: 1,
        channels: 4,
        colorspace: 0,
      });
      expect(() =>
        readQoiHeader(qoi(125, 1, [op.run(62), op.run(62)])),
      ).toThrow("data is truncated");
    });

    it("rejects chunks that end before the last pixel", () => {
      // A long enough tail that the minimum-length check passes.
      expect(() =>
        decodeQoi(qoi(64, 1, [op.rgb(1, 2, 3), op.diff(0, 0, 0)])),
      ).toThrow("data is truncated after 2 of 64 pixels");
    });

    it("rejects every truncation of a valid image", () => {
      const bytes = qoi(6, 1, [
        op.rgb(1, 2, 3),
        op.rgba(4, 5, 6, 7),
        op.luma(3, 1, -1),
        op.diff(1, 1, 1),
        op.index(hash([1, 2, 3, 255])),
        op.run(1),
      ]);
      expect(() => decodeQoi(bytes)).not.toThrow();
      for (let length = 0; length < bytes.length; length++) {
        expect(() => decodeQoi(bytes.subarray(0, length))).toThrow(
          /Invalid QOI image/,
        );
      }
    });

    it("rejects a missing or corrupt end marker", () => {
      const bytes = qoi(1, 1, [op.rgb(1, 2, 3)]);
      bytes[bytes.length - 1] = 0;
      expect(() => decodeQoi(bytes)).toThrow("missing end marker");

      const noMarker = new Uint8Array([
        ...header(1, 1),
        ...op.rgb(1, 2, 3),
        ...op.run(1),
        ...op.run(1),
        ...op.run(1),
        ...op.run(1),
        ...op.run(1),
        ...op.run(1),
        ...op.run(1),
        ...op.run(1),
      ]);
      expect(() => decodeQoi(noMarker)).toThrow("missing end marker");
    });

    it("rejects a last op that runs into the end marker", () => {
      // The image needs one more pixel, and the RGBA op that provides it
      // takes four bytes of what should be the end marker.
      const bytes = new Uint8Array([
        ...header(2, 1),
        ...op.rgb(1, 2, 3),
        0xff,
        ...END_MARKER,
      ]);
      expect(() => decodeQoi(bytes)).toThrow("missing end marker");
    });

    it("ignores bytes after the end marker", () => {
      const bytes = new Uint8Array([...qoi(1, 1, [op.rgb(1, 2, 3)]), 9, 9, 9]);
      expect(decodePixels(bytes)).toEqual([[1, 2, 3, 255]]);
    });
  });
});

// --- Round trip through FFmpeg's encoder -------------------------------------

const ffmpeg =
  process.env.FFMPEG ??
  (pathToFFmpeg && existsSync(pathToFFmpeg) ? pathToFFmpeg : null);

function ffmpegEncodeQoi(
  pixels: Uint8Array,
  width: number,
  height: number,
  pixFmt: "rgba" | "rgb24",
): Uint8Array {
  const result = spawnSync(
    ffmpeg!,
    [
      ...["-hide_banner", "-loglevel", "error"],
      ...["-f", "rawvideo", "-pix_fmt", pixFmt, "-s", `${width}x${height}`],
      ...["-i", "-", "-frames:v", "1", "-c:v", "qoi", "-f", "image2pipe", "-"],
    ],
    { input: pixels, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr.toString()}`);
  }
  return new Uint8Array(result.stdout);
}

/** Deterministic pseudo-random bytes (mulberry32). */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  };
}

type Pattern = (x: number, y: number, rand: () => number) => Rgba;

const patterns: Record<string, Pattern> = {
  // Every op: random pixels need RGB(A); a gradient needs DIFF and LUMA.
  noise: (_x, _y, rand) => [rand(), rand(), rand(), rand()],
  "opaque noise": (_x, _y, rand) => [rand(), rand(), rand(), 255],
  gradient: (x, y) => [x & 0xff, y & 0xff, (x + y) & 0xff, 255],
  "soft gradient": (x, y, rand) => [
    (x >> 1) + (rand() & 3),
    (y >> 1) + (rand() & 1),
    ((x + y) >> 2) + (rand() & 7),
    255,
  ],
  "alpha gradient": (x, y) => [200, 100, 50, (x * 3 + y) & 0xff],
  // Long runs and index hits: flat blocks of a few repeating colours.
  blocks: (x, y) => {
    const palette: Rgba[] = [
      [255, 0, 0, 255],
      [0, 0, 0, 0],
      [0, 128, 255, 128],
      [0, 0, 0, 255],
    ];
    return palette[((x >> 4) + (y >> 3)) % palette.length];
  },
  "sparse dots": (x, y, rand) =>
    (x * 7 + y * 13) % 97 === 0
      ? [rand(), rand(), rand(), 255]
      : [255, 255, 255, 255],
};

describe.skipIf(!ffmpeg)("decodeQoi round trip with FFmpeg's encoder", () => {
  const sizes: [number, number][] = [
    [1, 1],
    [37, 23],
    [320, 180],
  ];

  for (const [name, pattern] of Object.entries(patterns)) {
    for (const [width, height] of sizes) {
      it(`decodes ${name} at ${width}×${height} to the source pixels`, () => {
        const rand = random(width * 1000 + height);
        const rgba = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            rgba.set(pattern(x, y, rand), (y * width + x) * 4);
          }
        }

        const image = decodeQoi(ffmpegEncodeQoi(rgba, width, height, "rgba"));
        expect(image).toMatchObject({ width, height, channels: 4 });
        expect(Buffer.from(image.data).equals(Buffer.from(rgba))).toBe(true);
      });
    }
  }

  it("decodes a 3-channel image to the source pixels, opaque", () => {
    const [width, height] = [96, 54];
    const rand = random(3);
    const rgb = new Uint8Array(width * height * 3);
    const expected = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      // Mix noise, gradients and runs.
      const x = i % width;
      const pixel =
        x < 32
          ? [rand(), rand(), rand()]
          : x < 64
            ? [x, (i / width) | 0, 40]
            : [10, 20, 30];
      rgb.set(pixel, i * 3);
      expected.set([...pixel, 255], i * 4);
    }

    const image = decodeQoi(ffmpegEncodeQoi(rgb, width, height, "rgb24"));
    expect(image).toMatchObject({ width, height, channels: 3 });
    expect(Buffer.from(image.data).equals(Buffer.from(expected))).toBe(true);
  });
});
