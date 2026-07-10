import { describe, expect, test } from "vitest";

import { annieBuffer } from "./generate";
import type { AnnieFrame } from "./read";
import { annieFrames } from "./read";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];

/** Build a fake frame: magic bytes followed by filler of the given length */
function fakeFrame(magic: number[], filler: number, length: number): Buffer {
  const data = Buffer.alloc(length, filler);
  Buffer.from(magic).copy(data, 0);
  return data;
}

async function* toAsyncIterable(buffers: Buffer[]): AsyncIterable<Buffer> {
  for (const buffer of buffers) {
    yield buffer;
  }
}

async function collect(
  source: Parameters<typeof annieFrames>[0],
): Promise<AnnieFrame[]> {
  const frames: AnnieFrame[] = [];
  for await (const frame of annieFrames(source)) {
    frames.push(frame);
  }
  return frames;
}

/** Split a buffer into fixed-size chunks to exercise streaming reads */
function* chunked(buffer: Buffer, chunkSize: number): Generator<Uint8Array> {
  for (let i = 0; i < buffer.length; i += chunkSize) {
    yield new Uint8Array(buffer.subarray(i, i + chunkSize));
  }
}

describe("annieFrames", () => {
  test("round-trips frames written by annieBuffer", async () => {
    const written = [
      fakeFrame(PNG_MAGIC, 1, 700),
      fakeFrame(JPEG_MAGIC, 2, 512),
      fakeFrame(PNG_MAGIC, 3, 100),
    ];
    const annie = await annieBuffer(toAsyncIterable(written));

    const frames = await collect(new Uint8Array(annie));

    expect(frames).toHaveLength(3);
    expect(frames.map((f) => f.index)).toEqual([0, 1, 2]);
    expect(frames.map((f) => f.name)).toEqual([
      "frame_00000",
      "frame_00001",
      "frame_00002",
    ]);
    expect(frames.map((f) => f.contentType)).toEqual([
      "image/png",
      "image/jpeg",
      "image/png",
    ]);
    for (const [i, frame] of frames.entries()) {
      expect(Buffer.from(frame.data).equals(written[i])).toBe(true);
    }
  });

  test("reads from a chunked async byte stream", async () => {
    const written = [
      fakeFrame(PNG_MAGIC, 4, 1000),
      fakeFrame(JPEG_MAGIC, 5, 3),
    ];
    const annie = await annieBuffer(toAsyncIterable(written));

    // 7-byte chunks are never aligned with the 512-byte TAR blocks
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield* chunked(annie, 7);
    }
    const frames = await collect(chunks());

    expect(frames).toHaveLength(2);
    for (const [i, frame] of frames.entries()) {
      expect(Buffer.from(frame.data).equals(written[i])).toBe(true);
    }
  });

  test("reads from a sync iterable of chunks", async () => {
    const written = [fakeFrame(PNG_MAGIC, 6, 600)];
    const annie = await annieBuffer(toAsyncIterable(written));

    const frames = await collect(chunked(annie, 256));

    expect(frames).toHaveLength(1);
    expect(Buffer.from(frames[0].data).equals(written[0])).toBe(true);
  });

  test("reads from a Web ReadableStream", async () => {
    const written = [fakeFrame(JPEG_MAGIC, 7, 800)];
    const annie = await annieBuffer(toAsyncIterable(written));

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunked(annie, 300)) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
    const frames = await collect(stream);

    expect(frames).toHaveLength(1);
    expect(frames[0].contentType).toBe("image/jpeg");
    expect(Buffer.from(frames[0].data).equals(written[0])).toBe(true);
  });

  test("reads from an ArrayBuffer", async () => {
    const written = [fakeFrame(PNG_MAGIC, 8, 42)];
    const annie = await annieBuffer(toAsyncIterable(written));
    // Copying into a fresh Uint8Array yields a plain ArrayBuffer backing
    const arrayBuffer = new Uint8Array(annie).buffer;

    const frames = await collect(arrayBuffer);

    expect(frames).toHaveLength(1);
    expect(Buffer.from(frames[0].data).equals(written[0])).toBe(true);
  });

  test("reports unrecognized frame bytes as application/octet-stream", async () => {
    const annie = await annieBuffer(
      toAsyncIterable([Buffer.from("not an image")]),
    );

    const frames = await collect(new Uint8Array(annie));

    expect(frames).toHaveLength(1);
    expect(frames[0].contentType).toBe("application/octet-stream");
  });

  test("frame data does not alias the source bytes", async () => {
    const written = [fakeFrame(PNG_MAGIC, 9, 16)];
    const annie = await annieBuffer(toAsyncIterable(written));
    const source = new Uint8Array(annie);

    const frames = await collect(source);
    source.fill(0);

    expect(Buffer.from(frames[0].data).equals(written[0])).toBe(true);
  });

  test("rejects an annie with no frames", async () => {
    const annie = await annieBuffer(toAsyncIterable([]));

    await expect(collect(new Uint8Array(annie))).rejects.toThrow(
      "No frames found in the annie archive",
    );
  });

  test("skips entries that are not canonical frames", async () => {
    const written = [fakeFrame(PNG_MAGIC, 10, 200)];
    const annie = await annieBuffer(toAsyncIterable(written));
    // Prepend a non-frame entry (e.g. metadata) to the archive
    const extra = tarEntry("metadata.json", Buffer.from("{}"));
    const combined = Buffer.concat([extra, annie]);

    const frames = await collect(new Uint8Array(combined));

    expect(frames).toHaveLength(1);
    expect(frames[0].name).toBe("frame_00000");
  });

  test("rejects a truncated annie", async () => {
    const written = [fakeFrame(PNG_MAGIC, 11, 5000)];
    const annie = await annieBuffer(toAsyncIterable(written));
    const truncated = new Uint8Array(annie.subarray(0, 1000));

    await expect(collect(truncated)).rejects.toThrow(
      "Unexpected end of annie archive",
    );
  });

  test("rejects an archive with a corrupt header checksum", async () => {
    const written = [fakeFrame(PNG_MAGIC, 12, 100)];
    const annie = await annieBuffer(toAsyncIterable(written));
    const corrupted = new Uint8Array(annie);
    corrupted[0] ^= 0xff; // flip bits in the entry name

    await expect(collect(corrupted)).rejects.toThrow(
      "TAR header checksum mismatch",
    );
  });

  test("tolerates a stream that ends without the TAR terminator", async () => {
    const written = [fakeFrame(PNG_MAGIC, 13, 300)];
    const annie = await annieBuffer(toAsyncIterable(written));
    // Drop the trailing two zero blocks, as an aborted annieStream would
    const withoutTerminator = new Uint8Array(
      annie.subarray(0, annie.length - 1024),
    );

    const frames = await collect(withoutTerminator);

    expect(frames).toHaveLength(1);
    expect(Buffer.from(frames[0].data).equals(written[0])).toBe(true);
  });

  test("releases the source when iteration stops early", async () => {
    const written = [
      fakeFrame(PNG_MAGIC, 14, 100),
      fakeFrame(PNG_MAGIC, 15, 100),
    ];
    const annie = await annieBuffer(toAsyncIterable(written));

    let released = false;
    async function* chunks(): AsyncGenerator<Uint8Array> {
      try {
        yield* chunked(annie, 64);
      } finally {
        released = true;
      }
    }

    for await (const frame of annieFrames(chunks())) {
      expect(frame.index).toBe(0);
      break;
    }

    expect(released).toBe(true);
  });
});

/**
 * Build a single valid TAR entry (header + padded data) for a regular file,
 * mirroring the layout the annie writer produces.
 */
function tarEntry(name: string, data: Buffer): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "utf8");
  header.write("0000664 ", 100, "utf8");
  header.write("0001750 ", 108, "utf8");
  header.write("0001750 ", 116, "utf8");
  header.write(data.length.toString(8).padStart(11, "0") + " ", 124, "utf8");
  header.write("00000000000 ", 136, "utf8");
  header.write("        ", 148, "utf8");
  header.write("0", 156, "utf8");
  header.write("ustar ", 257, "utf8");
  header.write(" \0", 263, "utf8");
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "utf8");
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(padded, 0);
  return Buffer.concat([header, padded]);
}
