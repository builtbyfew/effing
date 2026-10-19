import type { ChildProcess } from "child_process";
import { execFile, spawn } from "child_process";
import { PassThrough, Readable, pipeline } from "stream";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { annieFrames } from "@effing/annie";
import { createWriteStream } from "fs";
import { promisify } from "util";

const pump = promisify(pipeline);

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

  buildArgs(inputResolver: (input: FFmpegInput) => string): string[] {
    const inputArgs: string[] = [];
    for (const input of this.inputs) {
      if (input.type === "color") {
        inputArgs.push(...input.preArgs);
      } else if (input.type === "animation") {
        inputArgs.push(
          ...input.preArgs,
          "-i",
          path.join(inputResolver(input), "frame_%05d"),
        );
      } else {
        inputArgs.push(...input.preArgs, "-i", inputResolver(input));
      }
    }
    const args = [
      ...this.globalArgs,
      ...inputArgs,
      "-filter_complex",
      this.filterComplex,
      ...this.outputArgs,
    ];
    return args;
  }
}

export class FFmpegRunner {
  private command: FFmpegCommand;

  private ffmpegProc?: ChildProcess;

  constructor(command: FFmpegCommand) {
    this.command = command;
  }

  async run(
    sourceFetcher: (input: {
      type: FFmpegInput["type"];
      src: string;
    }) => Promise<Readable>,
    referenceResolver?: (src: string) => string,
    urlTransformer?: (url: string) => string,
  ): Promise<Readable> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffs-"));
    const fileMapping = new Map<number, string>();
    // Cache for #reference sources to avoid duplicate fetches.
    // Uses promises to handle concurrent requests for the same source.
    // Key is input.source (the original #ref) to preserve deduplication.
    const fetchCache = new Map<string, Promise<string>>();

    const fetchAndSaveSource = async (
      input: FFmpegInput,
      sourceUrl: string,
      inputName: string,
    ): Promise<string> => {
      const stream = await sourceFetcher({
        type: input.type,
        src: sourceUrl,
      });

      if (input.type === "animation") {
        // we expect annie files for animations,
        // which are a TAR that needs to be extracted
        const extractionDir = path.join(tempDir, inputName);
        await fs.mkdir(extractionDir, { recursive: true });
        // Any error below (e.g. a malformed archive) propagates out of the
        // loop, destroys the source stream via the reader's cleanup, and
        // rejects this fetch instead of stalling.
        for await (const frame of annieFrames(stream)) {
          // Keep the on-disk names identical to the archive entry names so
          // the ffmpeg `frame_%05d` input pattern keeps matching.
          await fs.writeFile(path.join(extractionDir, frame.name), frame.data);
        }
        return extractionDir;
      } else {
        const tempFile = path.join(tempDir, inputName);
        await saveStreamToFile(stream, tempFile);
        return tempFile;
      }
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

      const finalArgs = this.command.buildArgs((input) => {
        const filePath = fileMapping.get(input.index);
        if (!filePath)
          throw new Error(`File for input index ${input.index} not found`);
        return filePath;
      });
      const ffmpegProc = spawn(await getFFmpegBin(), finalArgs);
      ffmpegProc.stderr!.on("data", (data) => {
        console.error(data.toString());
      });

      // Forward ffmpeg's stdout through a PassThrough so we can hold back
      // the end-of-stream signal until ffmpeg has actually exited. That way
      // consumers piping the returned stream see an `error` event on non-zero
      // exits instead of a silently-truncated "successful" render.
      const output = new PassThrough();
      ffmpegProc.stdout.pipe(output, { end: false });
      ffmpegProc.stdout.on("error", (err) => output.destroy(err));

      // A missing or non-executable binary does not make spawn() throw; it
      // surfaces as an asynchronous `error` event on the child, which would
      // crash the process without a listener. Fail the output stream and
      // clean up here, since `close` need not follow a spawn failure.
      ffmpegProc.on("error", async (err) => {
        if (!output.destroyed) output.destroy(err);
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      });

      ffmpegProc.on("close", async (code, signal) => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (err) {
          console.error("Error removing temp directory:", err);
        }
        if (code === 0 || signal === "SIGTERM") {
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
      // inside the try, so this never races with that handler.
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }

  close(): void {
    if (this.ffmpegProc) {
      this.ffmpegProc.kill("SIGTERM");
      this.ffmpegProc = undefined;
    }
  }
}
