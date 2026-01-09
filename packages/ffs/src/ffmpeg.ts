import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import type { Readable } from "stream";
import { pipeline } from "stream";
import fs from "fs/promises";
import os from "os";
import path from "path";
import pathToFFmpeg from "ffmpeg-static";
import tar from "tar-stream";
import { createWriteStream } from "fs";
import { promisify } from "util";

const pump = promisify(pipeline);

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
    sourceResolver: (input: {
      type: FFmpegInput["type"];
      src: string;
    }) => Promise<Readable>,
    imageTransformer?: (imageStream: Readable) => Promise<Readable>,
  ): Promise<Readable> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffs-"));
    const fileMapping = new Map<number, string>();
    // Cache for #reference sources to avoid duplicate fetches.
    // Uses promises to handle concurrent requests for the same source.
    const sourceCache = new Map<string, Promise<string>>();

    const fetchAndSaveSource = async (
      input: FFmpegInput,
      inputName: string,
    ): Promise<string> => {
      const stream = await sourceResolver({
        type: input.type,
        src: input.source,
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

        // Only cache #reference sources (not data URLs or regular URLs to avoid
        // memory issues with large URL strings as cache keys)
        const shouldCache = input.source.startsWith("#");

        if (shouldCache) {
          let fetchPromise = sourceCache.get(input.source);
          if (!fetchPromise) {
            fetchPromise = fetchAndSaveSource(input, inputName);
            sourceCache.set(input.source, fetchPromise);
          }
          const filePath = await fetchPromise;
          fileMapping.set(input.index, filePath);
        } else {
          const filePath = await fetchAndSaveSource(input, inputName);
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
    const ffmpegProc = spawn(process.env.FFMPEG ?? pathToFFmpeg!, finalArgs);
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
