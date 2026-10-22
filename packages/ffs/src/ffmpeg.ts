import type { ChildProcess } from "child_process";
import { execFile, spawn } from "child_process";
import type { Writable } from "stream";
import { PassThrough, Readable, pipeline } from "stream";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { createWriteStream } from "fs";
import { promisify } from "util";

import { AnnieExtraction, MAX_DECODE_TRACKS } from "./annie-extraction";

const pump = promisify(pipeline);

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Save a stream to a file. Errors on the stream destroy the file write so the
 * failure propagates instead of leaving a truncated file behind.
 */
async function saveStreamToFile(
  stream: Readable,
  outputPath: string,
): Promise<void> {
  const writeStream = createWriteStream(outputPath);
  stream.on("error", (e) => writeStream.destroy(e));
  await pump(stream, writeStream);
}

/**
 * Oldest FFmpeg version the filter graphs are built for (see the README): 6.1
 * still renders but drops the final frame of layered segments, 7.x rejects
 * segment transitions, and 8.0 lacks the alpha mode negotiation (the
 * `alpha_modes` option of `format`) that scaled renders use to shrink layers
 * with premultiplied alpha.
 */
const MIN_FFMPEG_VERSION = { major: 8, minor: 1 };

let resolvedBin: Promise<string> | undefined;

/**
 * Path of the FFmpeg binary to spawn, resolved once per process (see
 * resolveFFmpegBin) and cached, including the one-time version warning.
 */
function getFFmpegBin(): Promise<string> {
  resolvedBin ??= resolveFFmpegBin();
  return resolvedBin;
}

/**
 * Pick the binary: the FFMPEG env var, else the bundled `@effing/ffmpeg`
 * binary when that package is installed, else `ffmpeg` on PATH.
 */
async function resolveFFmpegBin(): Promise<string> {
  let bin = process.env.FFMPEG;
  if (!bin) {
    try {
      bin = (await import("@effing/ffmpeg")).pathToFFmpeg ?? undefined;
    } catch {
      // @effing/ffmpeg not installed
    }
  }
  bin ??= "ffmpeg";
  await warnIfUnsupportedVersion(bin);
  return bin;
}

/**
 * Whether an FFmpeg version string (as `ffmpeg -version` reports it, e.g.
 * "9.0.2", "n8.1.1" or "6.1.1-3ubuntu5") is at least MIN_FFMPEG_VERSION, or
 * undefined when it isn't a release version (e.g. a git build, "N-...").
 */
export function isSupportedFFmpegVersion(version: string): boolean | undefined {
  const match = /^n?(\d+)\.(\d+)/.exec(version);
  if (!match) return undefined;
  const [major, minor] = [parseInt(match[1], 10), parseInt(match[2], 10)];
  const { major: minMajor, minor: minMinor } = MIN_FFMPEG_VERSION;
  return major > minMajor || (major === minMajor && minor >= minMinor);
}

/**
 * Warn once when the resolved binary predates MIN_FFMPEG_VERSION, so a stale
 * or distro FFmpeg shows up here rather than as a cryptic filter error.
 */
async function warnIfUnsupportedVersion(bin: string): Promise<void> {
  let stdout: string;
  try {
    ({ stdout } = await promisify(execFile)(bin, ["-version"], {
      timeout: 5000,
    }));
  } catch {
    return; // Missing or broken binary: the spawn in run() reports that.
  }
  const version = /^ffmpeg version (\S+)/.exec(stdout)?.[1];
  // Git builds ("N-...") aren't checked.
  if (!version || isSupportedFFmpegVersion(version) !== false) return;
  const { major: minMajor, minor: minMinor } = MIN_FFMPEG_VERSION;
  console.warn(
    `@effing/ffs: FFmpeg ${version} (${bin}) is older than the supported ${minMajor}.${minMinor}; ` +
      "6.1 drops the final frame of layered segments, 7.x rejects transitions " +
      "and 8.0 fails renders with a scale other than 1",
  );
}

/**
 * Each input is represented by its index, its source, and the pre–arguments
 * that must appear immediately before its "-i" option.
 */
export type FFmpegInput = {
  index: number;
  source: string;
  preArgs: string[];
  type: "image" | "video" | "audio" | "color" | "animation";
};

/**
 * Where FFmpeg reads an input from: a file path or URL (for an animation,
 * the directory of its `frame_NNNNN` files), or, for an animation, a pipe.
 */
export type FFmpegInputSource = string | FFmpegPipeSource;

/**
 * An animation's frames, streamed as concatenated images through FFmpeg's
 * file descriptor `fd` and read with the stream demuxer `format` (e.g.
 * `jpeg_pipe`) instead of its input's image2 `-f`.
 *
 * With `tracks` (above 1), the frames are JPEGs in a Matroska stream of that
 * many tracks instead, frame i on track i mod `tracks`, at its time at the
 * input's `-framerate` (see AnnieExtraction.decodeTracks()). The input is
 * then read with the matroska demuxer, and the filter graph interleaves the
 * tracks back into the one stream it reads as `[<index>:v]` (see
 * FFmpegCommand.canSplitInput()).
 */
export type FFmpegPipeSource = { fd: number; format: string; tracks?: number };

/** `preArgs` with the input format (`-f`) replaced by `format`. */
function withInputFormat(preArgs: string[], format: string): string[] {
  const i = preArgs.indexOf("-f");
  if (i === -1) return ["-f", format, ...preArgs];
  return [...preArgs.slice(0, i + 1), format, ...preArgs.slice(i + 2)];
}

/** The value of an input's `-framerate`, if it has one. */
function inputFrameRate(input: FFmpegInput): string | undefined {
  const i = input.preArgs.indexOf("-framerate");
  return i === -1 ? undefined : input.preArgs[i + 1];
}

/**
 * The frame rate of an input's `-framerate` value ("30", "29.97" or
 * "30000/1001") in frames per second, or undefined if it isn't one of those.
 */
export function parseFrameRate(rate: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(?:\/(\d+))?$/.exec(rate);
  if (!match) return undefined;
  const fps = Number(match[1]) / (match[2] ? Number(match[2]) : 1);
  return fps > 0 && Number.isFinite(fps) ? fps : undefined;
}

/** The filter graph label of an input's video, as the renderer uses it. */
function videoLabel(input: FFmpegInput): string {
  return `[${input.index}:v]`;
}

export class FFmpegCommand {
  globalArgs: string[];
  inputs: FFmpegInput[];
  filterComplex: string;
  outputArgs: string[];

  constructor(
    globalArgs: string[],
    inputs: FFmpegInput[],
    filterComplex: string,
    outputArgs: string[],
  ) {
    this.globalArgs = globalArgs;
    this.inputs = inputs;
    this.filterComplex = filterComplex;
    this.outputArgs = outputArgs;
  }

  /**
   * Whether an animation input can be read as a Matroska stream of several
   * tracks (see FFmpegPipeSource): it has a `-framerate` (which sets the
   * frames' times), and the filter graph reads its video once, as
   * `[<index>:v]`.
   */
  canSplitInput(input: FFmpegInput): boolean {
    const rate = inputFrameRate(input);
    return (
      input.type === "animation" &&
      rate !== undefined &&
      parseFrameRate(rate) !== undefined &&
      this.filterComplex.split(videoLabel(input)).length === 2
    );
  }

  buildArgs(
    inputResolver: (input: FFmpegInput) => FFmpegInputSource,
  ): string[] {
    const inputArgs: string[] = [];
    // Chains that interleave split inputs' tracks, and the graph with their
    // `[<index>:v]` replaced by those chains' outputs.
    const interleaveChains: string[] = [];
    let filterComplex = this.filterComplex;
    for (const input of this.inputs) {
      if (input.type === "color") {
        inputArgs.push(...input.preArgs);
        continue;
      }
      const source = inputResolver(input);
      if (typeof source !== "string") {
        if (input.type !== "animation") {
          throw new Error(
            `Input ${input.index} (${input.type}) can't be piped`,
          );
        }
        if (source.tracks !== undefined && source.tracks > 1) {
          if (!this.canSplitInput(input)) {
            throw new Error(`Input ${input.index} can't be split into tracks`);
          }
          const rate = inputFrameRate(input)!;
          const label = `[pipe${input.index}v]`;
          // Each track's frames come with timestamps and durations in the
          // Matroska stream's milliseconds. settb=AVTB takes both to
          // microseconds, where interleave works (it would leave the
          // durations as they are), and interleave orders the frames by
          // timestamp. settb takes timestamps and durations back to 1/fps,
          // where the rounding lands on whole frames. interleave ends the
          // stream at its last frame's timestamp, where a single decoder
          // ends it one frame later: setpts, which also sees the end, moves
          // it there (PTS equals PREV_INPTS only at the end). The stream has
          // no frame rate set: the renderer's layer chains don't need one,
          // and its overlays' `fps` sets the output's.
          const tracks = Array.from(
            { length: source.tracks },
            (_, track) => `[pipe${input.index}t${track}]`,
          );
          const timeBase = rate.includes("/")
            ? rate.split("/").reverse().join("/")
            : `1/${rate}`;
          interleaveChains.push(
            ...tracks.map(
              (track, i) => `[${input.index}:${i}]settb=AVTB${track}`,
            ),
            `${tracks.join("")}interleave=nb_inputs=${source.tracks},settb=${timeBase},` +
              `setpts='PTS+eq(PTS,PREV_INPTS)'${label}`,
          );
          filterComplex = filterComplex.split(videoLabel(input)).join(label);
          const framerate = input.preArgs.indexOf("-framerate");
          const preArgs = [
            ...input.preArgs.slice(0, framerate),
            ...input.preArgs.slice(framerate + 2),
          ];
          inputArgs.push(
            // The tracks' frame rates aren't needed (the times are exact),
            // so don't read ahead to estimate them, which would hold FFmpeg
            // up until dozens of frames are in.
            "-fpsprobesize",
            "0",
            ...withInputFormat(preArgs, source.format),
            "-i",
            `pipe:${source.fd}`,
          );
          continue;
        }
        inputArgs.push(
          ...withInputFormat(input.preArgs, source.format),
          "-i",
          `pipe:${source.fd}`,
        );
      } else if (input.type === "animation") {
        inputArgs.push(...input.preArgs, "-i", path.join(source, "frame_%05d"));
      } else {
        inputArgs.push(...input.preArgs, "-i", source);
      }
    }
    const args = [
      ...this.globalArgs,
      ...inputArgs,
      "-filter_complex",
      [...interleaveChains, filterComplex].join(";"),
      ...this.outputArgs,
    ];
    return args;
  }
}

/**
 * How many tracks to split a JPEG annie over by default (see
 * AnnieExtraction.decodeTracks()): a decoder per 4 cores, at most 4. Two to
 * four decoders already outpace the rest of a render (the filter graph and
 * x264), and more cost memory and CPU time for nothing.
 */
function defaultDecodeTracks(): number {
  return Math.min(4, Math.max(1, Math.floor(os.availableParallelism() / 4)));
}

export type FFmpegRunnerOptions = {
  /**
   * The most tracks (FFmpeg decoders) a streamed JPEG annie is split over;
   * 1 not to split. Defaults to a decoder per 4 cores, at most 4.
   */
  decodeTracks?: number;
};

export class FFmpegRunner {
  private command: FFmpegCommand;
  private decodeTracks: number;

  private ffmpegProc?: ChildProcess;
  private closed = false;
  private extractions: AnnieExtraction[] = [];

  constructor(command: FFmpegCommand, options: FFmpegRunnerOptions = {}) {
    this.command = command;
    this.decodeTracks = Math.min(
      MAX_DECODE_TRACKS,
      Math.max(1, Math.floor(options.decodeTracks ?? defaultDecodeTracks())),
    );
  }

  /**
   * Fetches the sources and starts FFmpeg on them, and resolves with its
   * output.
   *
   * FFmpeg starts once every source is ready, except annies: those it reads
   * through a pipe as their frames come in, so it starts once each annie has
   * its first frame on disk (see AnnieExtraction). A source that fails
   * before FFmpeg starts rejects the returned promise; an annie that fails
   * after that stops FFmpeg and destroys the output with its error. A render
   * only succeeds once every annie is complete, even one FFmpeg didn't need
   * every frame of.
   */
  async run(
    sourceFetcher: (input: {
      type: FFmpegInput["type"];
      src: string;
    }) => Promise<Readable>,
    referenceResolver?: (src: string) => string,
    urlTransformer?: (url: string) => string,
  ): Promise<Readable> {
    if (this.closed) throw new Error("FFmpegRunner is closed");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffs-"));
    const fileMapping = new Map<number, string>();
    const animationMapping = new Map<number, AnnieExtraction>();
    // Cache for #reference sources to avoid duplicate fetches.
    // Uses promises to handle concurrent requests for the same source.
    // Key is input.source (the original #ref) to preserve deduplication.
    const fetchCache = new Map<string, Promise<string>>();
    const extractionCache = new Map<string, AnnieExtraction>();
    const extractions = this.extractions;
    const abortExtractions = () => {
      for (const extraction of extractions) extraction.abort();
    };

    const fetchAndSaveSource = async (
      input: FFmpegInput,
      sourceUrl: string,
      inputName: string,
    ): Promise<string> => {
      const stream = await sourceFetcher({
        type: input.type,
        src: sourceUrl,
      });
      const tempFile = path.join(tempDir, inputName);
      await saveStreamToFile(stream, tempFile);
      return tempFile;
    };

    /**
     * Starts extracting an annie (unless this #ref is extracted already),
     * and resolves once FFmpeg can start on it: when its first frame shows
     * that it can be streamed, else when it's complete.
     */
    const startAnnie = async (
      input: FFmpegInput,
      sourceUrl: string,
      inputName: string,
    ): Promise<void> => {
      // Deduplicate like other #refs: one extraction feeds every input.
      const shouldCache = input.source.startsWith("#");
      let extraction = shouldCache
        ? extractionCache.get(input.source)
        : undefined;
      if (!extraction) {
        extraction = new AnnieExtraction(path.join(tempDir, inputName), () =>
          sourceFetcher({ type: input.type, src: sourceUrl }),
        );
        extractions.push(extraction);
        if (shouldCache) extractionCache.set(input.source, extraction);
      }
      animationMapping.set(input.index, extraction);
      await extraction.firstFrame();
      if (!extraction.pipeFormat) await extraction.done;
    };

    try {
      await Promise.all(
        this.command.inputs.map(async (input) => {
          if (input.type === "color") return;

          const inputName = `ffmpeg_input_${input.index
            .toString()
            .padStart(3, "0")}`;

          // Resolve #references to get the actual URL
          const sourceUrl = referenceResolver
            ? referenceResolver(input.source)
            : input.source;

          // Pass HTTP(S) video/audio URLs directly to FFmpeg without downloading
          // If urlTransformer is provided, transform the URL (e.g., for proxy)
          if (
            (input.type === "video" || input.type === "audio") &&
            (sourceUrl.startsWith("http://") ||
              sourceUrl.startsWith("https://"))
          ) {
            const finalUrl = urlTransformer
              ? urlTransformer(sourceUrl)
              : sourceUrl;
            fileMapping.set(input.index, finalUrl);
            return;
          }

          if (input.type === "animation") {
            await startAnnie(input, sourceUrl, inputName);
            return;
          }

          // Deduplicate fetches when the same #ref appears multiple times.
          // Only for #refs since they're short strings; data URLs would bloat the map.
          const shouldCache = input.source.startsWith("#");
          if (shouldCache) {
            let fetchPromise = fetchCache.get(input.source);
            if (!fetchPromise) {
              fetchPromise = fetchAndSaveSource(input, sourceUrl, inputName);
              fetchCache.set(input.source, fetchPromise);
            }
            const filePath = await fetchPromise;
            fileMapping.set(input.index, filePath);
          } else {
            const filePath = await fetchAndSaveSource(
              input,
              sourceUrl,
              inputName,
            );
            fileMapping.set(input.index, filePath);
          }
        }),
      );

      // Annies stream into FFmpeg through pipes on fds 3, 4, ...
      const pipes: {
        fd: number;
        extraction: AnnieExtraction;
        tracks: number;
        fps: number;
      }[] = [];
      const finalArgs = this.command.buildArgs((input) => {
        const extraction = animationMapping.get(input.index);
        if (extraction?.pipeFormat) {
          const fd = 3 + pipes.length;
          const tracks = this.command.canSplitInput(input)
            ? extraction.decodeTracks(this.decodeTracks)
            : 1;
          const rate = input.preArgs[input.preArgs.indexOf("-framerate") + 1];
          const fps = tracks > 1 ? parseFrameRate(rate)! : 1;
          pipes.push({ fd, extraction, tracks, fps });
          return tracks > 1
            ? { fd, format: "matroska", tracks }
            : { fd, format: extraction.pipeFormat };
        }
        const filePath = extraction?.dir ?? fileMapping.get(input.index);
        if (!filePath)
          throw new Error(`File for input index ${input.index} not found`);
        return filePath;
      });
      const ffmpegBin = await getFFmpegBin();
      // close() may have been called while the sources were fetched.
      if (this.closed) throw new Error("FFmpegRunner is closed");
      // An annie may have failed after its first frame.
      const failed = extractions.find((e) => e.error !== undefined);
      if (failed) throw failed.error;
      const ffmpegProc = spawn(ffmpegBin, finalArgs, {
        stdio: ["pipe", "pipe", "pipe", ...pipes.map(() => "pipe" as const)],
      });
      ffmpegProc.stderr!.on("data", (data) => {
        console.error(data.toString());
      });
      const feedPipes = pipes.map(({ fd }) => ffmpegProc.stdio[fd] as Writable);
      // Close each pipe once its feed has ended it. Ending a socket only
      // shuts down its writing side, and FFmpeg, reading the other end of
      // the socketpair (what Node gives a child for a "pipe") through
      // pipe:N, occasionally misses that end of stream and waits for more
      // forever (seen on macOS in about 1 of 40 runs that end a small input
      // at once, and in 1 of ~80 slideshow renders). A closed socket's end
      // always gets through.
      for (const pipe of feedPipes) pipe.once("finish", () => pipe.destroy());
      const feeders = pipes.map(({ extraction, tracks, fps }, i) =>
        extraction.feed(feedPipes[i], { tracks, fps }),
      );

      // Forward ffmpeg's stdout through a PassThrough so we can hold back
      // the end-of-stream signal until ffmpeg has actually exited. That way
      // consumers piping the returned stream see an `error` event on non-zero
      // exits instead of a silently-truncated "successful" render.
      const output = new PassThrough();
      ffmpegProc.stdout!.pipe(output, { end: false });
      ffmpegProc.stdout!.on("error", (err) => output.destroy(err));
      // Once the output is destroyed (the render failed, or the consumer
      // gave up), pipe() stops reading stdout, and FFmpeg's `close`, which
      // waits for stdout to end, would never come. Drain it instead.
      output.once("close", () => ffmpegProc.stdout!.resume());

      // An annie that fails while FFmpeg runs fails the render: stop FFmpeg
      // and the other annies, and report the annie's error. Once FFmpeg has
      // exited, the `close` handler decides, and after close() nothing does:
      // both abort the annies themselves.
      let failure: unknown;
      let exited = false;
      const fail = (err: unknown) => {
        if (failure !== undefined || exited || this.closed) return;
        failure = err;
        abortExtractions();
        ffmpegProc.kill("SIGTERM");
        if (!output.destroyed) output.destroy(toError(err));
      };
      for (const extraction of extractions) extraction.done.catch(fail);

      /** Waits for the annies and feeds to stop, then removes the temp dir. */
      const cleanUp = async () => {
        await Promise.allSettled([
          ...extractions.map((e) => e.done),
          ...feeders,
        ]);
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (err) {
          console.error("Error removing temp directory:", err);
        }
      };

      // FFmpeg has stopped reading: unblock feeds waiting for it to drain
      // its pipes. (`close` waits for every pipe to close.)
      ffmpegProc.on("exit", () => {
        exited = true;
        for (const pipe of feedPipes) pipe.destroy();
      });

      // A missing or non-executable binary does not make spawn() throw; it
      // surfaces as an asynchronous `error` event on the child, which would
      // crash the process without a listener. Fail the output stream and
      // clean up here, since `close` need not follow a spawn failure.
      ffmpegProc.on("error", async (err) => {
        exited = true;
        abortExtractions();
        for (const pipe of feedPipes) pipe.destroy();
        if (!output.destroyed) output.destroy(err);
        await cleanUp();
      });

      ffmpegProc.on("close", async (code, signal) => {
        // Unless FFmpeg succeeded, the rest of the annies isn't needed.
        if (code !== 0) abortExtractions();
        await cleanUp();
        if (failure !== undefined || output.destroyed) return;
        // FFmpeg may finish before an annie it only needed some frames of.
        // That annie still has to complete, as it had to before FFmpeg
        // started when annies weren't streamed.
        const annieError =
          code === 0 && !this.closed
            ? extractions.find((e) => e.error !== undefined)?.error
            : undefined;
        if (annieError !== undefined) {
          output.destroy(toError(annieError));
        } else if (code === 0 || signal === "SIGTERM") {
          output.end();
        } else {
          output.destroy(
            new Error(
              `ffmpeg exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
            ),
          );
        }
      });

      this.ffmpegProc = ffmpegProc;
      return output;
    } catch (err) {
      // If anything fails before ffmpeg is spawned (e.g. an input fetch
      // rejects), the process `close` handler that normally removes the temp
      // dir never runs — clean it up here instead. The happy path returns
      // inside the try, so this never races with that handler. Annies still
      // being extracted stop at their next frame.
      abortExtractions();
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      if (this.closed) throw new Error("FFmpegRunner is closed");
      throw err;
    }
  }

  /** Stops FFmpeg, or keeps it from starting. The runner can't run again. */
  close(): void {
    this.closed = true;
    for (const extraction of this.extractions) extraction.abort();
    if (this.ffmpegProc) {
      this.ffmpegProc.kill("SIGTERM");
      this.ffmpegProc = undefined;
    }
  }
}
