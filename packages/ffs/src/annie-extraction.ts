import type { Readable, Writable } from "stream";
import fs from "fs/promises";
import path from "path";

import type { AnnieFrameContentType } from "@effing/annie";
import { annieFrames } from "@effing/annie";

import { matroskaFrameHeader, matroskaHeader } from "./matroska";

/**
 * The FFmpeg demuxers that read a stream of concatenated images of one
 * format, splitting it into frames with that format's parser.
 */
const PIPE_FORMATS: Partial<Record<AnnieFrameContentType, string>> = {
  "image/jpeg": "jpeg_pipe",
  "image/png": "png_pipe",
  "image/qoi": "qoi_pipe",
};

/**
 * The most decoder tracks a JPEG annie is split into (see
 * AnnieExtraction.decodeTracks()), and so the most leading frames whose
 * JPEG parameters are recorded.
 */
export const MAX_DECODE_TRACKS = 16;

/**
 * A JPEG annie that is complete when FFmpeg starts and has fewer frames than
 * this isn't split: there's too little to decode to gain anything.
 */
const MIN_FRAMES_TO_SPLIT = 16;

/**
 * The parts of a JPEG's headers that set what FFmpeg's decoder makes of it
 * (size, components, subsampling, bit depth, colour transform, aspect
 * ratio): the APP0 (JFIF), APP14 (Adobe) and SOFn segments, verbatim. Two
 * frames with the same parameters decode to frames of the same size, pixel
 * format and sample aspect ratio. Undefined when the headers can't be
 * walked up to the start of the scan.
 */
export function jpegParameters(bytes: Uint8Array): string | undefined {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data[0] !== 0xff || data[1] !== 0xd8) return undefined;
  const parts: string[] = [];
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) return undefined;
    const marker = data[offset + 1];
    if (marker === 0xff) {
      offset++; // fill byte
      continue;
    }
    if (marker === 0xda) return parts.join(","); // start of scan
    const length = data.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > data.length) return undefined;
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof || marker === 0xe0 || marker === 0xee) {
      parts.push(data.toString("hex", offset + 1, end));
    }
    offset = end;
  }
  return undefined;
}

/** The name FFmpeg's image2 `frame_%05d` input pattern gives frame `index`. */
export function frameFileName(index: number): string {
  return `frame_${index.toString().padStart(5, "0")}`;
}

/**
 * An annie, extracted frame by frame to a directory of files named like its
 * archive entries (`frame_00000`, `frame_00001`, ...) as it's fetched.
 *
 * FFmpeg reads the frames either from the directory, with the image2
 * `frame_%05d` pattern, once the extraction is complete, or through a pipe
 * while it's still going (see feed()), which lets FFmpeg start before the
 * annie has been generated in full. Extraction runs at the speed of the
 * source either way: frames land on disk, not in memory, and a pipe that
 * FFmpeg reads slowly never holds up the source.
 */
export class AnnieExtraction {
  readonly dir: string;
  /**
   * Resolves once every frame is on disk. Rejects when the fetch or the
   * extraction fails, or it was aborted.
   */
  readonly done: Promise<void>;
  /**
   * The demuxer to stream the frames to FFmpeg with (see feed()), known once
   * the first frame is in. Undefined when the frames can only be read as
   * files once the extraction is complete: the first entry isn't
   * `frame_00000` (image2 starts at the lowest index it finds), or it isn't
   * a PNG, JPEG or QOI image.
   */
  pipeFormat?: string;
  /** Why the extraction failed, once it has. */
  error?: unknown;

  private written = new Set<string>();
  /** jpegParameters() of the first MAX_DECODE_TRACKS frames, by index. */
  private leadingJpegParameters = new Map<number, string | undefined>();
  private ended = false;
  private aborted = false;
  private source?: Readable;
  private waiters: Array<() => void> = [];
  private onAbort?: () => void;

  constructor(dir: string, fetchSource: () => Promise<Readable>) {
    this.dir = dir;
    this.done = this.extract(fetchSource);
    // Whoever needs the outcome awaits `done`; an extraction nobody waits
    // for any more (the render failed or was closed) mustn't be an
    // unhandled rejection.
    this.done.catch(() => {});
  }

  private async extract(fetchSource: () => Promise<Readable>): Promise<void> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
      const source = await fetchSource();
      this.source = source;
      if (this.aborted) source.destroy();
      // abort() stops the loop below even while it waits for the source,
      // which a destroyed stream doesn't always end promptly.
      const aborted = new Promise<never>((_, reject) => {
        this.onAbort = () => reject(new Error("Annie extraction aborted"));
        if (this.aborted) this.onAbort();
      });
      aborted.catch(() => {});
      let firstType: AnnieFrameContentType | undefined;
      const frames = annieFrames(source);
      try {
        for (;;) {
          const next = await Promise.race([frames.next(), aborted]);
          if (next.done) break;
          const frame = next.value;
          if (firstType === undefined) {
            firstType = frame.contentType;
            if (frame.name === frameFileName(0)) {
              this.pipeFormat = PIPE_FORMATS[firstType];
            }
          } else if (this.pipeFormat && frame.contentType !== firstType) {
            // A stream demuxer decodes every frame with the first frame's
            // codec (image2 decodes files that way too, and drops the ones
            // that don't decode), so a mixed annie can't be streamed.
            throw new Error(
              `Annie frame ${frame.name} is ${frame.contentType}, but its first frame is ${firstType}: ` +
                "all frames of an annie must have the same image format",
            );
          }
          if (this.pipeFormat === "jpeg_pipe") {
            const index = leadingFrameIndex(frame.name);
            if (index !== undefined) {
              this.leadingJpegParameters.set(index, jpegParameters(frame.data));
            }
          }
          // Keep the on-disk names identical to the archive entry names so
          // the ffmpeg `frame_%05d` input pattern keeps matching.
          await fs.writeFile(path.join(this.dir, frame.name), frame.data);
          if (this.aborted) throw new Error("Annie extraction aborted");
          this.written.add(frame.name);
          this.notify();
        }
      } catch (err) {
        // Close the reader, which destroys the source. Not awaited: after
        // an abort, its cleanup may wait for a read the source never ends.
        // (An error from the reader itself has closed it already.)
        frames.return(undefined).catch(() => {});
        throw err;
      }
    } catch (err) {
      this.error = err;
      throw err;
    } finally {
      this.ended = true;
      this.notify();
    }
  }

  /** Stops the extraction (at the next frame); `done` rejects. */
  abort(): void {
    if (this.ended || this.aborted) return;
    this.aborted = true;
    this.source?.destroy();
    this.onAbort?.();
  }

  /**
   * Resolves once the first frame is on disk (and so `pipeFormat` known),
   * or the extraction has ended, completely or not.
   */
  async firstFrame(): Promise<void> {
    await this.until(() => this.written.size > 0 || this.ended);
  }

  /**
   * Resolves once frames 0 to `count - 1` are on disk, or the extraction
   * has ended.
   */
  async leadingFrames(count: number): Promise<void> {
    await this.until(
      () =>
        this.ended ||
        Array.from({ length: count }, (_, i) => frameFileName(i)).every(
          (name) => this.written.has(name),
        ),
    );
  }

  /**
   * How many tracks to split this annie's frames over when it's streamed
   * (see feed()), at most `max`, once its leading frames are in (see
   * leadingFrames(max)); 1 not to split it.
   *
   * FFmpeg's JPEG decoder is single-threaded, so it decodes an annie's
   * frames one after another, and slows down a render that has to decode
   * many large ones. Split over k tracks of a Matroska stream, frame i on
   * track i mod k, the frames are decoded by k decoders at once, and the
   * filter graph interleaves them back by timestamp. (One input with k
   * tracks, not k inputs: FFmpeg reads only the input the filter graph waits
   * on, so k inputs would still be decoded mostly one after another.)
   *
   * Only JPEG annies are split; PNG and QOI decoders are multi-threaded
   * already. Every track's first frame configures its own branch of the
   * filter graph, which the interleaving requires to match, so an annie is
   * split only if frames 0 to k-1 have the same JPEG parameters (see
   * jpegParameters()). Later frames may differ, as they may without the
   * split: they're normalised downstream (see animationChainHead). An annie
   * that is already complete and short isn't split either.
   */
  decodeTracks(max: number): number {
    if (this.pipeFormat !== "jpeg_pipe" || this.error !== undefined) return 1;
    if (this.ended && this.written.size < MIN_FRAMES_TO_SPLIT) return 1;
    let tracks = 0;
    while (
      tracks < Math.min(max, MAX_DECODE_TRACKS) &&
      this.written.has(frameFileName(tracks))
    ) {
      tracks++;
    }
    const first = this.leadingJpegParameters.get(0);
    if (first === undefined) return 1;
    for (let i = 1; i < tracks; i++) {
      if (this.leadingJpegParameters.get(i) !== first) return 1;
    }
    return Math.max(tracks, 1);
  }

  /**
   * Writes the frames to `pipe` as they land on disk, and ends it after the
   * last. They go in the order FFmpeg's image2 demuxer reads them from the
   * directory: frame_00000, frame_00001, ..., up to the first one the
   * extraction ends without.
   *
   * Every frame is read into the same buffer, once FFmpeg has taken the last
   * one, so a feed holds one frame's worth of memory however long the annie.
   * (A fresh buffer per frame would leave hundreds of MB of external memory
   * for the garbage collector to find.)
   *
   * With `tracks` above 1, the frames go into a Matroska stream of that
   * many tracks instead, frame i on track i mod `tracks` at its time at
   * `fps`, for FFmpeg's matroska demuxer (see decodeTracks()).
   *
   * `pipe` mustn't hold on to a chunk once it has called the chunk's write
   * callback, as a socket or file stream doesn't.
   *
   * Never rejects: when FFmpeg stops reading (it's done, failed or killed)
   * or the pipe is destroyed, the feed just stops. FFmpeg's exit status, and
   * the extraction's, tell whether the render worked.
   */
  async feed(
    pipe: Writable,
    { tracks = 1, fps = 1 }: { tracks?: number; fps?: number } = {},
  ): Promise<void> {
    // EPIPE when FFmpeg exits without reading everything.
    pipe.on("error", () => {});
    let buffer = Buffer.alloc(0);
    try {
      if (
        tracks > 1 &&
        !(await written(pipe, matroskaHeader(tracks, 1e9 / fps)))
      ) {
        return;
      }
      for (let index = 0; !pipe.destroyed; index++) {
        const name = frameFileName(index);
        await this.until(() => this.written.has(name) || this.ended);
        if (!this.written.has(name) || this.error !== undefined) break;
        const file = await fs.open(path.join(this.dir, name));
        let size: number;
        try {
          ({ size } = await file.stat());
          if (buffer.length < size) buffer = Buffer.allocUnsafe(size);
          await file.read(buffer, 0, size, 0);
        } finally {
          await file.close();
        }
        if (tracks > 1) {
          const header = matroskaFrameHeader(
            (index % tracks) + 1,
            Math.round((index * 1000) / fps),
            size,
          );
          // A fresh buffer: no need to wait until the pipe is done with it.
          pipe.write(header);
        }
        if (!(await written(pipe, buffer.subarray(0, size)))) break;
      }
    } catch {
      // A frame file that's gone: the temp dir was removed (FFmpeg exited).
    } finally {
      pipe.end();
    }
  }

  private async until(condition: () => boolean): Promise<void> {
    while (!condition()) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }

  private notify(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve();
  }
}

/** The index of a `frame_NNNNN` among the first MAX_DECODE_TRACKS, if it is one. */
function leadingFrameIndex(name: string): number | undefined {
  for (let i = 0; i < MAX_DECODE_TRACKS; i++) {
    if (name === frameFileName(i)) return i;
  }
  return undefined;
}

/**
 * Writes `chunk` to `stream`, and resolves once the stream is done with it
 * (true), or is destroyed (false).
 */
function written(stream: Writable, chunk: Buffer): Promise<boolean> {
  return new Promise((resolve) => {
    if (stream.destroyed) return resolve(false);
    const onClose = () => resolve(false);
    stream.once("close", onClose);
    stream.write(chunk, (err) => {
      stream.off("close", onClose);
      resolve(!err);
    });
  });
}
