import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import type { Readable } from "stream";
import { pipeline } from "stream";
import fs from "fs/promises";
import os from "os";
import path from "path";

import tar from "tar-stream";
import { createWriteStream } from "fs";
import { promisify } from "util";

const pump = promisify(pipeline);

let resolvedBin: string | undefined;
async function getFFmpegBin(): Promise<string> {
  if (resolvedBin) return resolvedBin;
  if (process.env.FFMPEG) {
    resolvedBin = process.env.FFMPEG;
    return resolvedBin;
  }
  try {
    const { pathToFFmpeg } = await import("@effing/ffmpeg");
    if (pathToFFmpeg) {
      resolvedBin = pathToFFmpeg;
      return resolvedBin;
    }
  } catch {
    // @effing/ffmpeg not installed
  }
  resolvedBin = "ffmpeg";
  return resolvedBin;
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
    imageTransformer?: (imageStream: Readable) => Promise<Readable>,
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
        const extract = tar.extract();
        const extractPromise = new Promise<void>((resolve, reject) => {
          extract.on("entry", async (header, stream, next) => {
            if (header.name.startsWith("frame_")) {
              const transformedStream = imageTransformer
                ? await imageTransformer(stream)
                : stream;
              const outputPath = path.join(extractionDir, header.name);
              const writeStream = createWriteStream(outputPath);
              transformedStream.pipe(writeStream);
              writeStream.on("finish", next);
              writeStream.on("error", reject);
            } else {
              stream.resume();
              next();
            }
          });
          extract.on("finish", resolve);
          extract.on("error", reject);
        });
        stream.pipe(extract);
        await extractPromise;
        return extractionDir;
      } else if (input.type === "image" && imageTransformer) {
        const tempFile = path.join(tempDir, inputName);
        const transformedStream = await imageTransformer(stream);
        const writeStream = createWriteStream(tempFile);
        transformedStream.on("error", (e) => writeStream.destroy(e));
        await pump(transformedStream, writeStream);
        return tempFile;
      } else {
        const tempFile = path.join(tempDir, inputName);
        const writeStream = createWriteStream(tempFile);
        stream.on("error", (e) => writeStream.destroy(e));
        await pump(stream, writeStream);
        return tempFile;
      }
    };

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
          (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://"))
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

    ffmpegProc.on("close", async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error("Error removing temp directory:", err);
      }
    });

    this.ffmpegProc = ffmpegProc;
    return ffmpegProc.stdout as Readable;
  }

  close(): void {
    if (this.ffmpegProc) {
      this.ffmpegProc.kill("SIGTERM");
      this.ffmpegProc = undefined;
    }
  }
}
