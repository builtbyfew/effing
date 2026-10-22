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
import { AnnieExtraction, jpegParameters } from "./annie-extraction";

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
/** 20 JPEG frames, enough to be split over several decoders. */
const longJpeg: Buffer[] = [];
/** A JPEG frame of another size (48x36). */
let otherSizeJpeg: Buffer;

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
  const dir = path.join(tempDir, "long-jpeg");
  await fsp.mkdir(dir);
  await execFileP(ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=s=32x24:r=${fps}`,
    "-frames:v",
    "20",
    "-c:v",
    "mjpeg",
    "-f",
    "image2",
    path.join(dir, "f%d"),
  ]);
  for (let i = 1; i <= 20; i++) {
    longJpeg.push(await fsp.readFile(path.join(dir, `f${i}`)));
  }
  await execFileP(ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=s=48x36:r=${fps}`,
    "-frames:v",
    "1",
    "-c:v",
    "mjpeg",
    "-f",
    "image2",
    path.join(dir, "other-size"),
  ]);
  otherSizeJpeg = await fsp.readFile(path.join(dir, "other-size"));
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

/**
 * A command that writes the frame checksums of its inputs' video. With
 * `chain`, each input goes through it first: `fps` makes the end of a
 * stream matter (its last frame lasts until then).
 */
function framemd5Command(inputs: FFmpegInput[], chain = "null"): FFmpegCommand {
  const filter =
    inputs.length === 1
      ? `[0:v]${chain}[outv]`
      : `${inputs.map((input) => `[${input.index}:v]${chain}[in${input.index}]`).join(";")};` +
        `${inputs.map((input) => `[in${input.index}]`).join("")}concat=n=${inputs.length}:v=1:a=0[outv]`;
  return new FFmpegCommand(["-y", "-loglevel", "error"], inputs, filter, [
    "-map",
    "[outv]",
    "-f",
    "framemd5",
    "-",
  ]);
}

/** What the image2 input decodes from these frames as files. */
async function framemd5FromFiles(
  frameData: Buffer[][],
  chain?: string,
): Promise<string> {
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
    chain,
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

  test("a split animation reads its tracks with the matroska demuxer and interleaves them", () => {
    const command = framemd5Command([animationInput(0, "#anim")]);
    const args = command.buildArgs(() => ({
      fd: 3,
      format: "matroska",
      tracks: 3,
    }));
    expect(args.slice(3, 11)).toEqual([
      "-fpsprobesize",
      "0",
      "-reinit_filter",
      "0",
      "-f",
      "matroska",
      "-i",
      "pipe:3",
    ]);
    expect(args[args.indexOf("-filter_complex") + 1]).toBe(
      "[0:0]settb=AVTB[pipe0t0];[0:1]settb=AVTB[pipe0t1];[0:2]settb=AVTB[pipe0t2];" +
        "[pipe0t0][pipe0t1][pipe0t2]interleave=nb_inputs=3,settb=1/10," +
        "setpts='PTS+eq(PTS,PREV_INPTS)'[pipe0v];[pipe0v]null[outv]",
    );
  });

  test("an animation the graph reads twice, or without a frame rate, can't be split", () => {
    const twice = new FFmpegCommand(
      [],
      [animationInput(0, "#anim")],
      "[0:v]null[a];[0:v]null[b]",
      [],
    );
    expect(twice.canSplitInput(twice.inputs[0])).toBe(false);
    const noRate = framemd5Command([
      {
        index: 0,
        source: "#anim",
        preArgs: ["-f", "image2"],
        type: "animation",
      },
    ]);
    expect(noRate.canSplitInput(noRate.inputs[0])).toBe(false);
    const ok = framemd5Command([animationInput(0, "#anim")]);
    expect(ok.canSplitInput(ok.inputs[0])).toBe(true);
    expect(() =>
      twice.buildArgs(() => ({ fd: 3, format: "matroska", tracks: 2 })),
    ).toThrow("can't be split");
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
      const runner = new FFmpegRunner(command, { decodeTracks: 1 });
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
        const runner = new FFmpegRunner(command, { decodeTracks: 1 });
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
      const runner = new FFmpegRunner(command, { decodeTracks: 1 });
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

  test("an annie that fails before its first frame rejects run()", async () => {
    const command = framemd5Command([animationInput(0, "#anim")]);
    const runner = new FFmpegRunner(command);
    await expect(
      runner.run(async () => {
        throw new Error("fetch failed");
      }),
    ).rejects.toThrow("fetch failed");
  });

  test("close() stops FFmpeg and the annies", { timeout: 10000 }, async () => {
    const g = gate();
    const command = framemd5Command([animationInput(0, "#anim")]);
    const runner = new FFmpegRunner(command, { decodeTracks: 1 });
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

describe("FFmpegRunner with JPEG annies split over several decoders", () => {
  /**
   * Runs `command` on annies, capturing FFmpeg's args. FFmpeg starts once
   * an (unused) image input comes in, 150 ms in, by when the annies'
   * leading frames are on disk (see streamedAnnie()).
   */
  async function runSplit(
    command: FFmpegCommand,
    decodeTracks: number,
    fetch: (input: { src: string }) => Promise<Readable>,
  ): Promise<{ output: string; args: string[] }> {
    const withLateImage = new FFmpegCommand(
      command.globalArgs,
      [
        ...command.inputs,
        {
          index: command.inputs.length,
          source: "#late",
          preArgs: [],
          type: "image",
        },
      ],
      command.filterComplex,
      command.outputArgs,
    );
    const buildArgs = vi.spyOn(withLateImage, "buildArgs");
    const runner = new FFmpegRunner(withLateImage, { decodeTracks });
    const output = await collect(
      await runner.run(async (input) => {
        if (input.src !== "#late") return fetch(input);
        await new Promise((resolve) => setTimeout(resolve, 150));
        return Readable.from([frames.png[0]]);
      }),
    );
    return { output, args: buildArgs.mock.results[0].value as string[] };
  }

  /**
   * An annie whose first `after` frames come at once, and the rest 300 ms
   * later, after FFmpeg started (see runSplit()).
   */
  function streamedAnnie(frameData: Buffer[], after: number): Readable {
    return gatedAnnie(frameData, {
      after,
      open: new Promise((resolve) => setTimeout(resolve, 300)),
    });
  }

  test.for([2, 3, 4, 7])(
    "%i tracks decode what one decoder does, to the end of the stream",
    { timeout: 10000 },
    async (tracks) => {
      const command = framemd5Command([animationInput(0, "#anim")], "fps=10");
      const { output, args } = await runSplit(command, tracks, async () =>
        streamedAnnie(longJpeg, tracks),
      );
      expect(args).toContain("matroska");
      expect(args.join(" ")).toContain(`interleave=nb_inputs=${tracks}`);
      expect(output).toBe(await framemd5FromFiles([longJpeg], "fps=10"));
    },
  );

  test(
    "a frame that doesn't decode leaves the same gap",
    { timeout: 10000 },
    async () => {
      const broken = [...longJpeg];
      broken[9] = Buffer.concat([longJpeg[9].subarray(0, 40)]);
      const command = framemd5Command([animationInput(0, "#anim")]);
      const { output, args } = await runSplit(command, 3, async () =>
        streamedAnnie(broken, 3),
      );
      expect(args).toContain("matroska");
      expect(output).toBe(await framemd5FromFiles([broken]));
    },
  );

  test(
    "a later frame of another size is normalised as without the split",
    { timeout: 10000 },
    async () => {
      const mixed = [...longJpeg];
      mixed[10] = otherSizeJpeg;
      const chain = "scale=w=iw:h=ih:eval=init,format=yuva420p";
      const command = framemd5Command([animationInput(0, "#anim")], chain);
      const { output, args } = await runSplit(command, 4, async () =>
        streamedAnnie(mixed, 4),
      );
      expect(args).toContain("matroska");
      expect(output).toBe(await framemd5FromFiles([mixed], chain));
    },
  );

  test(
    "an annie whose frames on disk differ isn't split",
    { timeout: 10000 },
    async () => {
      const chain = "scale=w=iw:h=ih:eval=init,format=yuva420p";
      const command = framemd5Command([animationInput(0, "#anim")], chain);
      const second = [...longJpeg];
      second[1] = otherSizeJpeg;
      const one = await runSplit(command, 4, async () =>
        streamedAnnie(second, 4),
      );
      expect(one.args).toContain("jpeg_pipe");
      expect(one.output).toBe(await framemd5FromFiles([second], chain));
      const third = [...longJpeg];
      third[2] = otherSizeJpeg;
      const two = await runSplit(command, 4, async () =>
        streamedAnnie(third, 4),
      );
      expect(two.args).toContain("jpeg_pipe");
      expect(two.output).toBe(await framemd5FromFiles([third], chain));
    },
  );

  test("PNG and QOI annies aren't split", { timeout: 10000 }, async () => {
    const command = framemd5Command([
      animationInput(0, "#png"),
      animationInput(1, "#qoi"),
    ]);
    const buildArgs = vi.spyOn(command, "buildArgs");
    const runner = new FFmpegRunner(command, { decodeTracks: 4 });
    const result = await collect(
      await runner.run(async ({ src }) =>
        streamedAnnie(src === "#png" ? frames.png : frames.qoi, 4),
      ),
    );
    const finalArgs = buildArgs.mock.results[0].value as string[];
    expect(finalArgs).toContain("png_pipe");
    expect(finalArgs).toContain("qoi_pipe");
    expect(result).toBe(await framemd5FromFiles([frames.png, frames.qoi]));
  });

  test(
    "FFmpeg doesn't wait for more frames of a JPEG annie to split it",
    { timeout: 10000 },
    async () => {
      const g = gate();
      const command = framemd5Command([animationInput(0, "#anim")]);
      const buildArgs = vi.spyOn(command, "buildArgs");
      const runner = new FFmpegRunner(command, { decodeTracks: 3 });
      // Resolves (FFmpeg has been spawned) with only frame 0 in.
      const output = await runner.run(async () =>
        gatedAnnie(longJpeg, { after: 1, open: g.promise }),
      );
      const result = collect(output);
      g.open();
      expect(buildArgs.mock.results[0].value).toContain("jpeg_pipe");
      expect(await result).toBe(await framemd5FromFiles([longJpeg]));
    },
  );

  test(
    "an annie used twice feeds both split inputs",
    { timeout: 10000 },
    async () => {
      // (fps: an interleaved stream has no frame rate set, which concat
      // would pass on to the output; the renderer's overlays set one.)
      const command = framemd5Command(
        [animationInput(0, "#anim"), animationInput(1, "#anim")],
        "fps=10",
      );
      const fetcher = vi.fn(async () => streamedAnnie(longJpeg, 4));
      const { output, args } = await runSplit(command, 4, fetcher);
      expect(args.filter((a) => a === "matroska")).toHaveLength(2);
      expect(output).toBe(
        await framemd5FromFiles([longJpeg, longJpeg], "fps=10"),
      );
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
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

  test("an annie that doesn't start at frame_00000 isn't streamed", async () => {
    const dir = await fsp.mkdtemp(path.join(tempDir, "extract-"));
    const extraction = new AnnieExtraction(dir, async () =>
      Readable.from([await tarOf([["frame_00001", frames.png[0]]])]),
    );
    await extraction.done;
    expect(extraction.pipeFormat).toBeUndefined();
  });

  test("decodeTracks() splits only JPEG annies whose frames match", async () => {
    const extract = async (entries: Buffer[]) => {
      const dir = await fsp.mkdtemp(path.join(tempDir, "extract-"));
      const extraction = new AnnieExtraction(dir, async () =>
        Readable.from([await annieBuffer(Readable.from(entries))]),
      );
      await extraction.done;
      return extraction;
    };
    expect((await extract(longJpeg)).decodeTracks(4)).toBe(4);
    expect((await extract(longJpeg)).decodeTracks(1)).toBe(1);
    // Complete and short: not worth it.
    expect((await extract(frames.jpeg)).decodeTracks(4)).toBe(1);
    expect(
      (
        await extract([
          ...frames.png,
          ...frames.png,
          ...frames.png,
          ...frames.png,
        ])
      ).decodeTracks(4),
    ).toBe(1);
    const mismatch = [...longJpeg];
    mismatch[17] = otherSizeJpeg;
    expect((await extract(mismatch)).decodeTracks(4)).toBe(1);
  });

  test("jpegParameters() reads the headers that set what a JPEG decodes to", () => {
    expect(jpegParameters(longJpeg[0])).toBeDefined();
    expect(jpegParameters(longJpeg[0])).toBe(jpegParameters(longJpeg[1]));
    expect(jpegParameters(otherSizeJpeg)).not.toBe(jpegParameters(longJpeg[0]));
    expect(jpegParameters(frames.png[0])).toBeUndefined();
    expect(jpegParameters(longJpeg[0].subarray(0, 30))).toBeUndefined();
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
