import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import { execFile } from "child_process";
import { Readable } from "stream";
import { finished } from "stream/promises";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { pathToFFmpeg } from "@effing/ffmpeg";
import { annieBuffer, annieStream } from "@effing/annie";
import tar from "tar-stream";
import { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
import type { FFmpegInput } from "./ffmpeg";
import { AnnieExtraction } from "./annie-extraction";

// Annies stream into FFmpeg through pipes while they're still being
// fetched (see AnnieExtraction). These tests run the real FFmpeg on tiny
// frames, and compare what it decodes with what the image2 frame_%05d input
// decodes from the same frames on disk.

const execFileP = promisify(execFile);
const ffmpegBin = process.env.FFMPEG ?? pathToFFmpeg ?? "ffmpeg";
const fps = 10;

let tempDir: string;
const frames: Record<"jpeg" | "png" | "qoi", Buffer[]> = {
  jpeg: [],
  png: [],
  qoi: [],
};

beforeAll(async () => {
  tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ffs-stream-test-"));
  // Six distinct 32x24 frames in each format.
  for (const [format, codec] of [
    ["jpeg", "mjpeg"],
    ["png", "png"],
    ["qoi", "qoi"],
  ] as const) {
    const dir = path.join(tempDir, format);
    await fsp.mkdir(dir);
    await execFileP(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc=s=32x24:r=${fps}`,
      "-frames:v",
      "6",
      "-c:v",
      codec,
      "-f",
      "image2",
      path.join(dir, "f%d"),
    ]);
    for (let i = 1; i <= 6; i++) {
      frames[format].push(await fsp.readFile(path.join(dir, `f${i}`)));
    }
  }
});

afterAll(async () => {
  await fsp.rm(tempDir, { recursive: true, force: true });
});

/** The animation input args the renderer builds (see buildLayerInput). */
const animationPreArgs = [
  "-reinit_filter",
  "0",
  "-f",
  "image2",
  "-framerate",
  fps.toString(),
];

function animationInput(index: number, source: string): FFmpegInput {
  return { index, source, preArgs: animationPreArgs, type: "animation" };
}

/** A command that writes the frame checksums of its inputs' video. */
function framemd5Command(inputs: FFmpegInput[]): FFmpegCommand {
  const filter =
    inputs.length === 1
      ? "[0:v]null[outv]"
      : `${inputs.map((input) => `[${input.index}:v]`).join("")}concat=n=${inputs.length}:v=1:a=0[outv]`;
  return new FFmpegCommand(["-y", "-loglevel", "error"], inputs, filter, [
    "-map",
    "[outv]",
    "-f",
    "framemd5",
    "-",
  ]);
}

/** What the image2 input decodes from these frames as files. */
async function framemd5FromFiles(frameData: Buffer[][]): Promise<string> {
  const dirs = await Promise.all(
    frameData.map(async (annieFrames) => {
      const dir = await fsp.mkdtemp(path.join(tempDir, "files-"));
      await Promise.all(
        annieFrames.map((data, i) =>
          fsp.writeFile(
            path.join(dir, `frame_${i.toString().padStart(5, "0")}`),
            data,
          ),
        ),
      );
      return dir;
    }),
  );
  const command = framemd5Command(
    dirs.map((dir, index) => animationInput(index, dir)),
  );
  const { stdout } = await execFileP(
    ffmpegBin,
    command.buildArgs((input) => input.source),
  );
  return stdout;
}

/** An annie stream whose frames come in only once `gate` resolves. */
function gatedAnnie(
  frameData: Buffer[],
  gate: { after: number; open: Promise<void> },
  fail?: Error,
): Readable {
  return Readable.fromWeb(
    annieStream(
      (async function* () {
        for (const [i, frame] of frameData.entries()) {
          if (i === gate.after) await gate.open;
          yield frame;
        }
        if (fail) throw fail;
      })(),
    ) as import("stream/web").ReadableStream,
  );
}

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { open, promise };
}

async function collect(output: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of output) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

describe("FFmpegCommand.buildArgs", () => {
  test("a piped animation reads its pipe with the given stream demuxer", () => {
    const command = framemd5Command([animationInput(0, "#anim")]);
    const args = command.buildArgs(() => ({ fd: 3, format: "jpeg_pipe" }));
    expect(args.slice(3, 11)).toEqual([
      "-reinit_filter",
      "0",
      "-f",
      "jpeg_pipe",
      "-framerate",
      "10",
      "-i",
      "pipe:3",
    ]);
  });

  test("only animations can be piped", () => {
    const command = framemd5Command([
      { index: 0, source: "#img", preArgs: [], type: "image" },
    ]);
    expect(() =>
      command.buildArgs(() => ({ fd: 3, format: "png_pipe" })),
    ).toThrow("can't be piped");
  });
});

describe("FFmpegRunner with streamed annies", () => {
  test.for(["jpeg", "png", "qoi"] as const)(
    "%s frames decode as they do from files",
    { timeout: 10000 },
    async (format) => {
      const command = framemd5Command([animationInput(0, "#anim")]);
      const runner = new FFmpegRunner(command);
      const output = await runner.run(async () =>
        Readable.from([await annieBuffer(Readable.from(frames[format]))]),
      );
      expect(await collect(output)).toBe(
        await framemd5FromFiles([frames[format]]),
      );
    },
  );

  test(
    "FFmpeg starts once each annie has its first frame",
    { timeout: 10000 },
    async () => {
      const g = gate();
      const command = framemd5Command([
        animationInput(0, "#a"),
        animationInput(1, "#b"),
      ]);
      const runner = new FFmpegRunner(command);
      const fetcher = vi.fn(async ({ src }: { src: string }) =>
        src === "#a"
          ? gatedAnnie(frames.jpeg, { after: 2, open: g.promise })
          : gatedAnnie(frames.qoi, { after: 1, open: g.promise }),
      );
      // Resolves (FFmpeg has been spawned) while both annies wait for the gate.
      const output = await runner.run(fetcher);
      const result = collect(output);
      g.open();
      expect(await result).toBe(
        await framemd5FromFiles([frames.jpeg, frames.qoi]),
      );
    },
  );

  test(
    "an annie used twice is fetched once and feeds both inputs",
    { timeout: 10000 },
    async () => {
      const command = framemd5Command([
        animationInput(0, "#anim"),
        animationInput(1, "#anim"),
      ]);
      const runner = new FFmpegRunner(command);
      const fetcher = vi.fn(async () =>
        Readable.from([await annieBuffer(Readable.from(frames.png))]),
      );
      const output = await runner.run(fetcher);
      expect(await collect(output)).toBe(
        await framemd5FromFiles([frames.png, frames.png]),
      );
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  test(
    "an annie that fails after FFmpeg started fails the output and stops FFmpeg",
    { timeout: 10000 },
    async () => {
      const mkdtempSpy = vi.spyOn(fsp, "mkdtemp");
      try {
        const g = gate();
        const command = framemd5Command([animationInput(0, "#anim")]);
        const runner = new FFmpegRunner(command);
        const output = await runner.run(async () =>
          gatedAnnie(
            frames.jpeg,
            { after: 3, open: g.promise },
            new Error("generation failed"),
          ),
        );
        output.resume();
        g.open();
        await expect(finished(output)).rejects.toThrow("generation failed");
        const runTempDir = await mkdtempSpy.mock.results[0].value;
        await vi.waitFor(
          () => expect(fsp.access(runTempDir)).rejects.toThrow(),
          { timeout: 5000 },
        );
      } finally {
        mkdtempSpy.mockRestore();
      }
    },
  );

  test(
    "an annie still fails the render when FFmpeg didn't need its last frames",
    { timeout: 10000 },
    async () => {
      // FFmpeg only reads 2 frames and exits before the annie fails.
      const g = gate();
      const command = new FFmpegCommand(
        ["-y", "-loglevel", "error"],
        [animationInput(0, "#anim")],
        "[0:v]trim=end_frame=2[outv]",
        ["-map", "[outv]", "-f", "framemd5", "-"],
      );
      const runner = new FFmpegRunner(command);
      const output = await runner.run(async () =>
        gatedAnnie(
          frames.jpeg,
          { after: 5, open: g.promise },
          new Error("generation failed"),
        ),
      );
      output.resume();
      setTimeout(g.open, 300);
      await expect(finished(output)).rejects.toThrow("generation failed");
    },
  );

  test(
    "an annie that mixes image formats fails the render",
    { timeout: 10000 },
    async () => {
      const command = framemd5Command([animationInput(0, "#anim")]);
      const runner = new FFmpegRunner(command);
      const output = await runner.run(async () =>
        Readable.from([
          await annieBuffer(
            Readable.from([...frames.jpeg.slice(0, 3), frames.png[3]]),
          ),
        ]),
      );
      output.resume();
      await expect(finished(output)).rejects.toThrow(
        "all frames of an annie must have the same image format",
      );
    },
  );

  test(
    "a frame that can't be fed fails the render",
    { timeout: 10000 },
    async () => {
      // The feed ends the pipe early, so FFmpeg exits 0 on what it got.
      const realOpen = fsp.open;
      const openSpy = vi
        .spyOn(fsp, "open")
        .mockImplementation(async (file, ...rest) => {
          if (String(file).endsWith("frame_00002")) {
            throw new Error("EIO: frame unreadable");
          }
          return realOpen(file, ...rest);
        });
      try {
        const command = framemd5Command([animationInput(0, "#anim")]);
        const runner = new FFmpegRunner(command);
        const output = await runner.run(async () =>
          Readable.from([await annieBuffer(Readable.from(frames.jpeg))]),
        );
        output.resume();
        await expect(finished(output)).rejects.toThrow("frame unreadable");
      } finally {
        openSpy.mockRestore();
      }
    },
  );

  test("an annie that fails before its first frame rejects run()", async () => {
    const command = framemd5Command([animationInput(0, "#anim")]);
    const runner = new FFmpegRunner(command);
    await expect(
      runner.run(async () => {
        throw new Error("fetch failed");
      }),
    ).rejects.toThrow("fetch failed");
  });

  test(
    "a consumer that destroys the output stops the annies",
    { timeout: 10000 },
    async () => {
      const g = gate();
      const command = framemd5Command([animationInput(0, "#anim")]);
      const runner = new FFmpegRunner(command);
      const source = gatedAnnie(frames.jpeg, { after: 2, open: g.promise });
      const output = await runner.run(async () => source);
      output.destroy();
      await vi.waitFor(() => expect(source.destroyed).toBe(true));
    },
  );

  test("close() stops FFmpeg and the annies", { timeout: 10000 }, async () => {
    const g = gate();
    const command = framemd5Command([animationInput(0, "#anim")]);
    const runner = new FFmpegRunner(command);
    const source = gatedAnnie(frames.jpeg, { after: 2, open: g.promise });
    const output = await runner.run(async () => source);
    output.resume();
    runner.close();
    // The output ends, or fails with FFmpeg's exit code when FFmpeg had
    // installed its signal handlers already: either way, it settles.
    await finished(output).catch(() => {});
    expect(source.destroyed).toBe(true);
  });
});

describe("AnnieExtraction", () => {
  async function tarOf(entries: [string, Buffer][]): Promise<Buffer> {
    const pack = tar.pack();
    for (const [name, data] of entries) pack.entry({ name }, data);
    pack.finalize();
    const chunks: Buffer[] = [];
    for await (const chunk of pack) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async function fed(extraction: AnnieExtraction): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const { PassThrough } = await import("stream");
    const pipe = new PassThrough();
    // feed() reuses its buffer once a write is done, which a PassThrough
    // doesn't copy: copy it here, like a socket does.
    pipe.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    await extraction.feed(pipe);
    return Buffer.concat(chunks);
  }

  test("feeds frames in frame_%05d order up to the first missing one", async () => {
    const dir = await fsp.mkdtemp(path.join(tempDir, "extract-"));
    const [a, b, c, d] = frames.png;
    const extraction = new AnnieExtraction(dir, async () =>
      Readable.from([
        await tarOf([
          ["frame_00000", a],
          ["frame_00002", c],
          ["frame_00001", b],
          // image2 stops at the gap at frame_00003
          ["frame_00004", d],
        ]),
      ]),
    );
    await extraction.firstFrame();
    expect(extraction.pipeFormat).toBe("png_pipe");
    expect(await fed(extraction)).toEqual(Buffer.concat([a, b, c]));
    await extraction.done;
  });

  test("a feed rejects when a frame on disk can't be read", async () => {
    const dir = await fsp.mkdtemp(path.join(tempDir, "extract-"));
    const [a, b] = frames.png;
    const extraction = new AnnieExtraction(dir, async () =>
      Readable.from([
        await tarOf([
          ["frame_00000", a],
          ["frame_00001", b],
        ]),
      ]),
    );
    await extraction.done;
    await fsp.rm(path.join(dir, "frame_00001"));
    await expect(fed(extraction)).rejects.toThrow(/ENOENT/);
  });

  test("an annie that doesn't start at frame_00000 isn't streamed", async () => {
    const dir = await fsp.mkdtemp(path.join(tempDir, "extract-"));
    const extraction = new AnnieExtraction(dir, async () =>
      Readable.from([await tarOf([["frame_00001", frames.png[0]]])]),
    );
    await extraction.done;
    expect(extraction.pipeFormat).toBeUndefined();
  });

  test("frames of an unknown format aren't streamed", async () => {
    const dir = await fsp.mkdtemp(path.join(tempDir, "extract-"));
    const extraction = new AnnieExtraction(dir, async () =>
      Readable.from([await tarOf([["frame_00000", Buffer.alloc(600, 1)]])]),
    );
    await extraction.done;
    expect(extraction.pipeFormat).toBeUndefined();
  });
});
