/**
 * Annie generation utilities (TAR archives of PNG frames)
 */

const TAR_BLOCK_SIZE = 512;

/**
 * Create a TAR header for a file entry
 */
function createTarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(TAR_BLOCK_SIZE);

  // Filename (100 bytes)
  const nameBytes = Buffer.from(name.slice(0, 100), "utf8");
  nameBytes.copy(header, 0);

  // Mode (8 bytes octal) - 0000664 = regular file, rw-rw-r--
  header.write("0000664 ", 100, "utf8");

  // UID (8 bytes octal)
  header.write("0001750 ", 108, "utf8");

  // GID (8 bytes octal)
  header.write("0001750 ", 116, "utf8");

  // Size (12 bytes octal)
  const sizeOctal = size.toString(8).padStart(11, "0") + " ";
  header.write(sizeOctal, 124, "utf8");

  // Modification time (12 bytes octal)
  const mtime =
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, "0") + " ";
  header.write(mtime, 136, "utf8");

  // Checksum placeholder (8 bytes) - fill with spaces initially
  header.write("        ", 148, "utf8");

  // Type flag (1 byte) - '0' for regular file
  header.write("0", 156, "utf8");

  // Magic (6 bytes)
  header.write("ustar ", 257, "utf8");

  // Version (2 bytes)
  header.write(" \0", 263, "utf8");

  // Calculate checksum (sum of all bytes, treating checksum field as spaces)
  let checksum = 0;
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
    checksum += header[i];
  }

  // Write checksum (8 bytes octal)
  const checksumOctal = checksum.toString(8).padStart(6, "0") + "\0 ";
  header.write(checksumOctal, 148, "utf8");

  return header;
}

/**
 * Pad data to TAR block size (512 bytes)
 */
function padToBlockSize(data: Buffer): Buffer {
  const remainder = data.length % TAR_BLOCK_SIZE;
  if (remainder === 0) return data;
  const padding = Buffer.alloc(TAR_BLOCK_SIZE - remainder);
  return Buffer.concat([data, padding]);
}

/**
 * Options for annie stream generation
 */
export type AnnieStreamOptions = {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
};

type ChunkOptions = {
  framePrefix?: string;
  frameDigits?: number;
  signal?: AbortSignal;
};

/**
 * Generate TAR archive chunks from an async iterator of frame buffers
 */
async function* tarChunks(
  frames: AsyncIterable<Buffer>,
  options: ChunkOptions = {},
): AsyncGenerator<Buffer> {
  const { framePrefix = "frame_", frameDigits = 5, signal } = options;
  let i = 0;
  for await (const frame of frames) {
    if (signal?.aborted) {
      return;
    }

    const name = `${framePrefix}${i.toString().padStart(frameDigits, "0")}`;

    // Yield TAR header
    yield createTarHeader(name, frame.length);

    // Yield padded frame data
    yield padToBlockSize(frame);

    i++;
  }

  // Write two empty blocks (1024 bytes) to indicate end of TAR archive
  if (!signal?.aborted) {
    yield Buffer.alloc(TAR_BLOCK_SIZE * 2);
  }
}

/**
 * Collect all frames into a single annie Buffer (TAR archive)
 *
 * @param frames Async iterator yielding PNG or JPEG frame buffers
 * @returns Complete annie as a Buffer
 *
 * @example
 * ```ts
 * const frames = renderAnnieFrames(annieId, props, { width, height });
 * const annie = await annieBuffer(frames);
 * await fs.writeFile("animation.tar", annie);
 * ```
 */
export async function annieBuffer(
  frames: AsyncIterable<Buffer>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of tarChunks(frames)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Create a ReadableStream that produces an annie (TAR archive of frames)
 *
 * Use this when you need the stream but want to customize the Response yourself.
 *
 * @param frames Async iterator yielding PNG or JPEG frame buffers
 * @param options Configuration options
 * @returns ReadableStream of annie data
 *
 * @example
 * ```ts
 * const frames = renderAnnieFrames(annieId, props, { width, height });
 * const stream = annieStream(frames, { signal: request.signal });
 * return new Response(stream, {
 *   headers: { "Content-Type": "application/x-tar" }
 * });
 * ```
 */
export function annieStream(
  frames: AsyncIterable<Buffer>,
  options: AnnieStreamOptions = {},
): ReadableStream<Buffer> {
  const abortController = new AbortController();
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, abortController.signal])
    : abortController.signal;

  let iterator: AsyncGenerator<Buffer> | null = null;

  return new ReadableStream({
    async start() {
      iterator = tarChunks(frames, { signal: combinedSignal });
    },
    async pull(controller) {
      if (!iterator) return;

      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (err) {
        if (!combinedSignal.aborted) {
          controller.error(err);
        }
      }
    },
    cancel() {
      abortController.abort();
      iterator?.return(undefined).catch(() => {});
    },
  });
}
