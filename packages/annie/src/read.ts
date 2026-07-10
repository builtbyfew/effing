/**
 * Annie reading utilities (parse TAR archives of PNG/JPEG frames)
 *
 * This is the canonical reader for the format produced by the writers in
 * `generate.ts`: a TAR archive whose frame entries are named
 * `frame_<index>` with a zero-padded index (width 5) and no file
 * extension. The image format is not recorded anywhere in the archive, so
 * it is sniffed from each frame's magic bytes.
 *
 * The reader is runtime-neutral: it has no Node.js dependencies and works
 * on plain bytes, (async) iterables of bytes (which includes Node
 * `Readable` streams), and Web `ReadableStream`s.
 */

const TAR_BLOCK_SIZE = 512;

const FRAME_NAME_PATTERN = /^frame_(\d+)$/;

/**
 * Content type of a frame, sniffed from its magic bytes.
 *
 * Annie frames are expected to be PNG or JPEG; anything else is reported
 * as `application/octet-stream` and left for the consumer to handle.
 */
export type AnnieFrameContentType =
  | "image/png"
  | "image/jpeg"
  | "application/octet-stream";

/**
 * A single frame read from an annie.
 */
export type AnnieFrame = {
  /** Frame index parsed from the entry name (e.g. 3 for `frame_00003`) */
  index: number;
  /** Original TAR entry name (e.g. `frame_00003`) */
  name: string;
  /** Content type sniffed from the frame's magic bytes */
  contentType: AnnieFrameContentType;
  /** Frame bytes (an independent copy, safe to retain) */
  data: Uint8Array;
};

/**
 * Byte source an annie can be read from.
 *
 * Node `Readable` streams satisfy `AsyncIterable<Uint8Array>`, and Web
 * `ReadableStream`s are consumed via async iteration where available,
 * falling back to `getReader()` otherwise.
 */
export type AnnieSource =
  | Uint8Array
  | ArrayBuffer
  | Iterable<Uint8Array>
  | AsyncIterable<Uint8Array>
  | ReadableStream<Uint8Array>;

function sniffContentType(bytes: Uint8Array): AnnieFrameContentType {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "application/octet-stream";
}

async function* streamChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function chunksOf(
  source: AnnieSource,
): Iterable<Uint8Array> | AsyncIterable<Uint8Array> {
  if (source instanceof Uint8Array) return [source];
  if (source instanceof ArrayBuffer) return [new Uint8Array(source)];
  if (
    Symbol.asyncIterator in source ||
    Symbol.iterator in (source as Iterable<Uint8Array>)
  ) {
    return source as Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
  }
  if (typeof (source as ReadableStream<Uint8Array>).getReader === "function") {
    // ReadableStream in an environment without async iteration support
    return streamChunks(source as ReadableStream<Uint8Array>);
  }
  throw new TypeError("Unsupported annie source");
}

/**
 * Buffers an (async) iterable of byte chunks and hands out exact-size reads.
 */
class ByteReader {
  private iterator: Iterator<Uint8Array> | AsyncIterator<Uint8Array>;
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;

  constructor(chunks: Iterable<Uint8Array> | AsyncIterable<Uint8Array>) {
    this.iterator =
      Symbol.asyncIterator in chunks
        ? chunks[Symbol.asyncIterator]()
        : chunks[Symbol.iterator]();
  }

  /**
   * Read exactly `n` bytes. Returns null on a clean end of input (no bytes
   * left over); throws if the input ends partway through.
   */
  async read(n: number): Promise<Uint8Array | null> {
    while (this.pendingBytes < n) {
      const { done, value } = await this.iterator.next();
      if (done) {
        if (this.pendingBytes === 0) return null;
        throw new Error("Unexpected end of annie archive");
      }
      if (value.length > 0) {
        this.pending.push(value);
        this.pendingBytes += value.length;
      }
    }
    return this.take(n);
  }

  /** Release the underlying source (e.g. destroy a Node stream). */
  async close(): Promise<void> {
    await this.iterator.return?.();
  }

  private take(n: number): Uint8Array {
    this.pendingBytes -= n;
    const first = this.pending[0];
    if (first.length >= n) {
      const out = first.subarray(0, n);
      if (first.length === n) {
        this.pending.shift();
      } else {
        this.pending[0] = first.subarray(n);
      }
      return out;
    }
    const out = new Uint8Array(n);
    let offset = 0;
    while (offset < n) {
      const chunk = this.pending[0];
      const needed = n - offset;
      if (chunk.length <= needed) {
        out.set(chunk, offset);
        offset += chunk.length;
        this.pending.shift();
      } else {
        out.set(chunk.subarray(0, needed), offset);
        this.pending[0] = chunk.subarray(needed);
        offset = n;
      }
    }
    return out;
  }
}

function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i++) {
    if (block[i] !== 0) return false;
  }
  return true;
}

function parseOctal(block: Uint8Array, offset: number, length: number): number {
  const text = new TextDecoder()
    .decode(block.subarray(offset, offset + length))
    .replace(/\0/g, " ")
    .trim();
  const value = text === "" ? 0 : parseInt(text, 8);
  if (Number.isNaN(value)) {
    throw new Error("Invalid annie archive: malformed TAR header");
  }
  return value;
}

function parseName(block: Uint8Array): string {
  let end = 0;
  while (end < 100 && block[end] !== 0) end++;
  return new TextDecoder().decode(block.subarray(0, end));
}

function verifyChecksum(block: Uint8Array): void {
  const expected = parseOctal(block, 148, 8);
  let sum = 0;
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
    // The checksum field itself counts as spaces
    sum += i >= 148 && i < 156 ? 0x20 : block[i];
  }
  if (sum !== expected) {
    throw new Error("Invalid annie archive: TAR header checksum mismatch");
  }
}

/**
 * Async-iterate the frames of an annie (a TAR archive of image frames).
 *
 * Yields only the frame entries (names matching `frame_<digits>`), in
 * archive order — which the annie writers guarantee to be ascending index
 * order. Other entries are skipped. The frame's image format is detected
 * from its magic bytes (the archive does not record it).
 *
 * Throws if the archive is truncated, has a corrupt header, or contains no
 * frames at all.
 *
 * @param source Annie bytes: a `Uint8Array`/`ArrayBuffer`, an (async)
 *   iterable of byte chunks (e.g. a Node `Readable`), or a Web
 *   `ReadableStream`
 *
 * @example
 * ```ts
 * for await (const frame of annieFrames(await fs.readFile("animation.annie"))) {
 *   console.log(frame.index, frame.contentType, frame.data.length);
 * }
 * ```
 */
export async function* annieFrames(
  source: AnnieSource,
): AsyncGenerator<AnnieFrame, void, undefined> {
  const reader = new ByteReader(chunksOf(source));
  let frameCount = 0;
  try {
    for (;;) {
      const header = await reader.read(TAR_BLOCK_SIZE);
      // Tolerate input that ends cleanly without the two-zero-block
      // terminator (e.g. an aborted annieStream).
      if (header === null || isZeroBlock(header)) break;
      verifyChecksum(header);

      const name = parseName(header);
      const size = parseOctal(header, 124, 12);
      const typeflag = header[156];
      const paddedSize = Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
      const block = paddedSize > 0 ? await reader.read(paddedSize) : null;
      if (paddedSize > 0 && block === null) {
        throw new Error("Unexpected end of annie archive");
      }

      // Regular files only ('0' or the pre-POSIX NUL typeflag)
      if (typeflag !== 0x30 && typeflag !== 0) continue;
      const match = FRAME_NAME_PATTERN.exec(name);
      if (!match) continue;

      // .slice() copies, so the frame doesn't alias the source chunks
      const data = block ? block.slice(0, size) : new Uint8Array(0);
      frameCount++;
      yield {
        index: parseInt(match[1], 10),
        name,
        contentType: sniffContentType(data),
        data,
      };
    }
  } finally {
    await reader.close();
  }
  if (frameCount === 0) {
    throw new Error("No frames found in the annie archive");
  }
}
