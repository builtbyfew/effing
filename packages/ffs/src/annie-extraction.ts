import type { Readable, Writable } from "stream";
import fs from "fs/promises";
import path from "path";

import type { AnnieFrameContentType } from "@effing/annie";
import { annieFrames } from "@effing/annie";

/**
 * The FFmpeg demuxers that read a stream of concatenated images of one
 * format, splitting it into frames with that format's parser.
 */
const PIPE_FORMATS: Partial<Record<AnnieFrameContentType, string>> = {
  "image/jpeg": "jpeg_pipe",
  "image/png": "png_pipe",
  "image/qoi": "qoi_pipe",
};

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
   * Writes the frames to `pipe` as they land on disk, and ends it after the
   * last. They go in the order FFmpeg's image2 demuxer reads them from the
   * directory: frame_00000, frame_00001, ..., up to the first one the
   * extraction ends without. One frame at a time is held in memory: the next
   * is read from disk once FFmpeg has taken the last.
   *
   * Never rejects: when FFmpeg stops reading (it's done, failed or killed)
   * or the pipe is destroyed, the feed just stops. FFmpeg's exit status, and
   * the extraction's, tell whether the render worked.
   */
  async feed(pipe: Writable): Promise<void> {
    // EPIPE when FFmpeg exits without reading everything.
    pipe.on("error", () => {});
    try {
      for (let index = 0; !pipe.destroyed; index++) {
        const name = frameFileName(index);
        await this.until(() => this.written.has(name) || this.ended);
        if (!this.written.has(name) || this.error !== undefined) break;
        if (pipe.destroyed) break;
        const data = await fs.readFile(path.join(this.dir, name));
        if (!pipe.write(data)) await drained(pipe);
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

/** Resolves once `stream` can take more data, or is closed. */
function drained(stream: Writable): Promise<void> {
  return new Promise((resolve) => {
    // A write to a destroyed stream returns false too, and it won't emit
    // anything after that.
    if (stream.destroyed || !stream.writableNeedDrain) return resolve();
    const done = () => {
      stream.off("drain", done);
      stream.off("close", done);
      resolve();
    };
    stream.on("drain", done);
    stream.on("close", done);
  });
}
