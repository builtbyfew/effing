import { test, expect, describe } from "vitest";
import { annieBuffer, annieStream } from "./generate";

const TAR_BLOCK_SIZE = 512;

/**
 * Helper to create an async iterable from an array of buffers
 */
async function* asyncFrames(frames: Buffer[]): AsyncGenerator<Buffer> {
  for (const frame of frames) {
    yield frame;
  }
}

/**
 * Helper to collect all chunks from an async iterable
 */
async function collectChunks(
  stream: ReadableStream<Buffer>,
): Promise<Buffer[]> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

/**
 * Parse TAR header to extract metadata
 */
function parseTarHeader(header: Buffer) {
  const name = header.subarray(0, 100).toString("utf8").replace(/\0+$/, "");
  const sizeStr = header.subarray(124, 135).toString("utf8").trim();
  const size = parseInt(sizeStr, 8);
  const checksumStr = header.subarray(148, 154).toString("utf8").trim();
  const checksum = parseInt(checksumStr, 8);
  const typeFlag = header.subarray(156, 157).toString("utf8");
  const magic = header.subarray(257, 263).toString("utf8").replace(/\0+$/, "");
  return { name, size, checksum, typeFlag, magic };
}

/**
 * Calculate expected TAR checksum
 */
function calculateChecksum(header: Buffer): number {
  let sum = 0;
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
    // Checksum field (bytes 148-155) should be treated as spaces
    if (i >= 148 && i < 156) {
      sum += 32; // space character
    } else {
      sum += header[i];
    }
  }
  return sum;
}

describe("annieBuffer", () => {
  test("empty frames produces valid TAR with end-of-archive marker", async () => {
    const buffer = await annieBuffer(asyncFrames([]));

    // Should only contain the two empty blocks (1024 bytes) for end of archive
    expect(buffer.length).toBe(TAR_BLOCK_SIZE * 2);
    expect(buffer.every((byte) => byte === 0)).toBe(true);
  });

  test("single frame produces valid TAR entry", async () => {
    const frameData = Buffer.from("PNG frame data here");
    const buffer = await annieBuffer(asyncFrames([frameData]));

    // Should have: header (512) + padded data (512) + end marker (1024)
    const expectedPaddedSize = TAR_BLOCK_SIZE; // 19 bytes padded to 512
    expect(buffer.length).toBe(
      TAR_BLOCK_SIZE + expectedPaddedSize + TAR_BLOCK_SIZE * 2,
    );

    // Parse header
    const header = buffer.subarray(0, TAR_BLOCK_SIZE);
    const { name, size, typeFlag, magic } = parseTarHeader(header);

    expect(name).toBe("frame_00000");
    expect(size).toBe(frameData.length);
    expect(typeFlag).toBe("0");
    expect(magic.trim()).toBe("ustar");

    // Verify checksum
    const storedChecksum = parseTarHeader(header).checksum;
    const calculatedChecksum = calculateChecksum(header);
    expect(storedChecksum).toBe(calculatedChecksum);

    // Verify frame data is in the archive
    const dataSection = buffer.subarray(TAR_BLOCK_SIZE, TAR_BLOCK_SIZE * 2);
    expect(dataSection.subarray(0, frameData.length).equals(frameData)).toBe(
      true,
    );
  });

  test("multiple frames produces sequential TAR entries", async () => {
    const frames = [
      Buffer.from("Frame 0"),
      Buffer.from("Frame 1 with more data"),
      Buffer.from("Frame 2"),
    ];
    const buffer = await annieBuffer(asyncFrames(frames));

    // Each frame: 512 header + 512 padded data
    // Plus 1024 end marker
    expect(buffer.length).toBe(3 * TAR_BLOCK_SIZE * 2 + TAR_BLOCK_SIZE * 2);

    // Parse each header
    for (let i = 0; i < frames.length; i++) {
      const headerOffset = i * TAR_BLOCK_SIZE * 2;
      const header = buffer.subarray(
        headerOffset,
        headerOffset + TAR_BLOCK_SIZE,
      );
      const { name, size } = parseTarHeader(header);

      expect(name).toBe(`frame_${i.toString().padStart(5, "0")}`);
      expect(size).toBe(frames[i].length);

      // Verify data
      const dataOffset = headerOffset + TAR_BLOCK_SIZE;
      const data = buffer.subarray(dataOffset, dataOffset + frames[i].length);
      expect(data.equals(frames[i])).toBe(true);
    }
  });

  test("frame data larger than block size is properly padded", async () => {
    // Create frame larger than 512 bytes
    const largeFrame = Buffer.alloc(600, 0x42); // 600 bytes of 'B'
    const buffer = await annieBuffer(asyncFrames([largeFrame]));

    // Padded size should be 1024 (2 blocks)
    const paddedDataSize = Math.ceil(600 / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
    expect(buffer.length).toBe(
      TAR_BLOCK_SIZE + paddedDataSize + TAR_BLOCK_SIZE * 2,
    );

    // Verify size in header
    const header = buffer.subarray(0, TAR_BLOCK_SIZE);
    const { size } = parseTarHeader(header);
    expect(size).toBe(600);

    // Verify actual data
    const data = buffer.subarray(TAR_BLOCK_SIZE, TAR_BLOCK_SIZE + 600);
    expect(data.equals(largeFrame)).toBe(true);
  });

  test("frame exactly block size needs no padding", async () => {
    const exactFrame = Buffer.alloc(TAR_BLOCK_SIZE, 0x43);
    const buffer = await annieBuffer(asyncFrames([exactFrame]));

    // header (512) + data (512, no padding needed) + end marker (1024)
    expect(buffer.length).toBe(TAR_BLOCK_SIZE * 4);
  });
});

describe("annieStream", () => {
  test("produces same output as annieBuffer", async () => {
    const frames = [
      Buffer.from("Stream frame 0"),
      Buffer.from("Stream frame 1"),
    ];

    const bufferResult = await annieBuffer(asyncFrames(frames));

    const stream = annieStream(asyncFrames(frames));
    const chunks = await collectChunks(stream);
    const streamResult = Buffer.concat(chunks);

    expect(streamResult.equals(bufferResult)).toBe(true);
  });

  test("empty frames produces valid stream", async () => {
    const stream = annieStream(asyncFrames([]));
    const chunks = await collectChunks(stream);
    const result = Buffer.concat(chunks);

    expect(result.length).toBe(TAR_BLOCK_SIZE * 2);
  });

  test("stream can be cancelled", async () => {
    // Create a slow frame generator
    async function* slowFrames(): AsyncGenerator<Buffer> {
      yield Buffer.from("Frame 0");
      await new Promise((r) => setTimeout(r, 100));
      yield Buffer.from("Frame 1");
      await new Promise((r) => setTimeout(r, 100));
      yield Buffer.from("Frame 2");
    }

    const stream = annieStream(slowFrames());
    const reader = stream.getReader();

    // Read first chunk
    const { done: done1 } = await reader.read();
    expect(done1).toBe(false);

    // Cancel the stream
    await reader.cancel();

    // Stream should be closed
    const { done: done2 } = await reader.read();
    expect(done2).toBe(true);
  });

  test("respects abort signal", async () => {
    const abortController = new AbortController();
    let frameCount = 0;

    async function* countingFrames(): AsyncGenerator<Buffer> {
      while (true) {
        frameCount++;
        yield Buffer.from(`Frame ${frameCount}`);
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    const stream = annieStream(countingFrames(), {
      signal: abortController.signal,
    });
    const reader = stream.getReader();

    // Read a few chunks
    await reader.read();
    await reader.read();

    // Abort
    abortController.abort();

    // Give it a moment to process
    await new Promise((r) => setTimeout(r, 50));

    // Frame generation should have stopped
    const countAfterAbort = frameCount;
    await new Promise((r) => setTimeout(r, 50));
    expect(frameCount).toBe(countAfterAbort);

    reader.releaseLock();
  });

  test("chunks are yielded incrementally", async () => {
    const frames = [Buffer.from("A"), Buffer.from("B"), Buffer.from("C")];

    const stream = annieStream(asyncFrames(frames));
    const reader = stream.getReader();
    const chunkSizes: number[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunkSizes.push(value.length);
    }

    // Should have individual chunks, not one big buffer
    // 3 frames × 2 chunks each (header + data) + 1 end marker = 7 chunks
    expect(chunkSizes.length).toBe(7);

    // Each chunk should be TAR_BLOCK_SIZE (headers, padded data, or end marker)
    for (const size of chunkSizes.slice(0, -1)) {
      expect(size).toBe(TAR_BLOCK_SIZE);
    }
    // Last chunk is end marker (2 blocks)
    expect(chunkSizes[chunkSizes.length - 1]).toBe(TAR_BLOCK_SIZE * 2);
  });
});

describe("TAR format compliance", () => {
  test("header has correct structure", async () => {
    const frame = Buffer.from("test");
    const buffer = await annieBuffer(asyncFrames([frame]));
    const header = buffer.subarray(0, TAR_BLOCK_SIZE);

    // Mode at offset 100 (8 bytes)
    const mode = header.subarray(100, 108).toString("utf8").trim();
    expect(mode).toBe("0000664");

    // UID at offset 108 (8 bytes)
    const uid = header.subarray(108, 116).toString("utf8").trim();
    expect(uid).toBe("0001750");

    // GID at offset 116 (8 bytes)
    const gid = header.subarray(116, 124).toString("utf8").trim();
    expect(gid).toBe("0001750");

    // Type flag at offset 156 (1 byte)
    const typeFlag = header.subarray(156, 157).toString("utf8");
    expect(typeFlag).toBe("0");

    // Magic at offset 257 (6 bytes)
    const magic = header.subarray(257, 263).toString("utf8");
    expect(magic).toBe("ustar ");

    // Version at offset 263 (2 bytes)
    const version = header.subarray(263, 265);
    expect(version[0]).toBe(32); // space
    expect(version[1]).toBe(0); // null
  });

  test("checksum is correctly calculated", async () => {
    const frame = Buffer.from("checksum test data");
    const buffer = await annieBuffer(asyncFrames([frame]));
    const header = buffer.subarray(0, TAR_BLOCK_SIZE);

    // Manually calculate checksum
    let sum = 0;
    for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
      if (i >= 148 && i < 156) {
        sum += 32; // checksum field treated as spaces
      } else {
        sum += header[i];
      }
    }

    // Extract stored checksum
    const checksumStr = header.subarray(148, 154).toString("utf8").trim();
    const storedChecksum = parseInt(checksumStr, 8);

    expect(storedChecksum).toBe(sum);
  });

  test("end of archive marker is two zero blocks", async () => {
    const buffer = await annieBuffer(asyncFrames([Buffer.from("x")]));
    const endMarker = buffer.subarray(buffer.length - TAR_BLOCK_SIZE * 2);

    expect(endMarker.length).toBe(TAR_BLOCK_SIZE * 2);
    expect(endMarker.every((byte) => byte === 0)).toBe(true);
  });

  test("mtime is a valid timestamp", async () => {
    const before = Math.floor(Date.now() / 1000);
    const buffer = await annieBuffer(asyncFrames([Buffer.from("time test")]));
    const after = Math.floor(Date.now() / 1000);

    const header = buffer.subarray(0, TAR_BLOCK_SIZE);
    const mtimeStr = header.subarray(136, 147).toString("utf8").trim();
    const mtime = parseInt(mtimeStr, 8);

    expect(mtime).toBeGreaterThanOrEqual(before);
    expect(mtime).toBeLessThanOrEqual(after);
  });
});

describe("frame naming", () => {
  test("frames are named with zero-padded numbers", async () => {
    const frames = Array.from({ length: 12 }, (_, i) =>
      Buffer.from(`Frame ${i}`),
    );
    const buffer = await annieBuffer(asyncFrames(frames));

    const expectedNames = [
      "frame_00000",
      "frame_00001",
      "frame_00002",
      "frame_00003",
      "frame_00004",
      "frame_00005",
      "frame_00006",
      "frame_00007",
      "frame_00008",
      "frame_00009",
      "frame_00010",
      "frame_00011",
    ];

    for (let i = 0; i < frames.length; i++) {
      const headerOffset = i * TAR_BLOCK_SIZE * 2;
      const header = buffer.subarray(
        headerOffset,
        headerOffset + TAR_BLOCK_SIZE,
      );
      const { name } = parseTarHeader(header);
      expect(name).toBe(expectedNames[i]);
    }
  });
});
