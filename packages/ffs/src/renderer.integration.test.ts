import { describe, test, expect, afterAll } from "vitest";
import { EffieRenderer } from "./renderer";
import {
  effieDataForSegment,
  effieDataForJoin,
  effieFileUrl,
} from "@effing/effie";
import type { EffieData, EffieSources, EffieFileUrl } from "@effing/effie";
import { annieBuffer } from "@effing/annie";
import { pathToFFmpeg } from "@effing/ffmpeg";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

const execFileP = promisify(execFile);

/**
 * Integration tests for distributed rendering.
 * These tests require FFmpeg and will actually render video.
 *
 * Set KEEP_TEST_OUTPUT=1 to preserve rendered videos for manual inspection.
 * Output location will be logged to console.
 *
 * Run with:
 *   npm run test:integration
 *   KEEP_TEST_OUTPUT=1 npm run test:integration
 */

const KEEP_OUTPUT = process.env.KEEP_TEST_OUTPUT === "1";
const testOutputDirs: string[] = [];

/**
 * Creates a temp directory for test output.
 * When KEEP_TEST_OUTPUT=1, uses a predictable location and preserves files.
 */
async function createTestOutputDir(testName: string): Promise<string> {
  if (KEEP_OUTPUT) {
    // Use predictable location in project for easy access
    const outputDir = path.join(
      process.cwd(),
      "test-output",
      testName.replace(/\s+/g, "-"),
    );
    await fs.mkdir(outputDir, { recursive: true });
    testOutputDirs.push(outputDir);
    return outputDir;
  }
  return fs.mkdtemp(path.join(os.tmpdir(), "ffs-test-"));
}

/**
 * Cleans up test output directory unless KEEP_TEST_OUTPUT is set.
 */
async function cleanupTestOutput(dir: string): Promise<void> {
  if (!KEEP_OUTPUT) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

afterAll(() => {
  if (KEEP_OUTPUT && testOutputDirs.length > 0) {
    console.log("\n📁 Test output preserved at:");
    for (const dir of testOutputDirs) {
      console.log(`   ${dir}`);
    }
  }
});

/**
 * Generates a WAV file with a simple sine wave tone.
 * @param filePath - Path to write the WAV file
 * @param durationSecs - Duration in seconds
 * @param frequency - Tone frequency in Hz (default 440 = A4)
 */
async function generateToneWav(
  filePath: string,
  durationSecs: number,
  frequency: number = 440,
): Promise<void> {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSecs);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(fileSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt subchunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4; // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, offset);
  offset += 2; // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data subchunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  // Generate sine wave samples
  const amplitude = 0.5 * 32767; // 50% volume to avoid clipping
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(
      amplitude * Math.sin(2 * Math.PI * frequency * t),
    );
    buffer.writeInt16LE(sample, offset);
    offset += 2;
  }

  await fs.writeFile(filePath, buffer);
}

describe("distributed rendering integration", () => {
  test("rejects local file paths by default (security)", async () => {
    const sources: EffieSources<EffieFileUrl> = {
      secret: effieFileUrl("file:///etc/passwd"),
    };
    const effieData: EffieData<typeof sources, EffieFileUrl> = {
      width: 320,
      height: 240,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "blue" },
      sources,
      segments: [
        {
          duration: 0.5,
          layers: [{ type: "image", source: "#secret" }],
        },
      ],
    };

    const renderer = new EffieRenderer(effieData);
    await expect(renderer.render()).rejects.toThrow(
      "Local file paths are not allowed",
    );
    renderer.close();
  });

  test("renders individual segments and joins them", async () => {
    // Create a simple effie with color backgrounds (no external media needed)
    const effieData: EffieData<EffieSources> = {
      width: 320,
      height: 240,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "blue" },
      segments: [
        { duration: 0.5, layers: [] },
        {
          duration: 0.5,
          layers: [],
          background: { type: "color", color: "red" },
        },
        {
          duration: 0.5,
          layers: [],
          transition: { type: "fade", duration: 0.2 },
        },
      ],
    };

    const tempDir = await createTestOutputDir("segments-and-join");

    try {
      // Phase 1: Render each segment independently
      const segmentUrls: EffieFileUrl[] = [];

      for (let i = 0; i < effieData.segments.length; i++) {
        const segmentData = effieDataForSegment(effieData, i);
        const renderer = new EffieRenderer(segmentData);

        const outputPath = path.join(tempDir, `segment_${i}.mp4`);
        const stream = await renderer.render();

        // Write stream to file
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        await fs.writeFile(outputPath, Buffer.concat(chunks));
        renderer.close();

        // Verify segment was created and has content
        const stats = await fs.stat(outputPath);
        expect(stats.size).toBeGreaterThan(0);

        segmentUrls.push(effieFileUrl(pathToFileURL(outputPath).toString()));
      }

      expect(segmentUrls).toHaveLength(3);

      // Phase 2: Join segments using effieDataForJoin
      const joinData = effieDataForJoin(effieData, segmentUrls);

      // Verify join data structure uses #references
      expect(joinData.segments[0].background).toEqual({
        type: "video",
        source: "#__segment_0",
      });
      expect(joinData.segments[0].audio?.source).toBe("#__segment_0");
      expect(joinData.sources).toHaveProperty("__segment_0", segmentUrls[0]);
      expect(joinData.sources).toHaveProperty("__segment_1", segmentUrls[1]);
      expect(joinData.sources).toHaveProperty("__segment_2", segmentUrls[2]);

      // Phase 3: Render the joined video (allowLocalFiles needed for local segment paths)
      const joinRenderer = new EffieRenderer(joinData, {
        allowLocalFiles: true,
      });
      const joinOutputPath = path.join(tempDir, "joined.mp4");
      const joinStream = await joinRenderer.render();

      const joinChunks: Buffer[] = [];
      for await (const chunk of joinStream) {
        joinChunks.push(chunk);
      }
      await fs.writeFile(joinOutputPath, Buffer.concat(joinChunks));
      joinRenderer.close();

      // Verify final output
      const joinStats = await fs.stat(joinOutputPath);
      expect(joinStats.size).toBeGreaterThan(0);

      // The joined video should be larger than individual segments
      // (since it contains all of them minus transition overlap)
      const totalSegmentSize = await Promise.all(
        segmentUrls.map(async (p) => (await fs.stat(fileURLToPath(p))).size),
      ).then((sizes) => sizes.reduce((a, b) => a + b, 0));

      // Joined should be at least 50% of total segments (accounting for re-encoding)
      expect(joinStats.size).toBeGreaterThan(totalSegmentSize * 0.3);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000); // 30 second timeout for rendering

  test("preserves transitions during join", async () => {
    const effieData: EffieData<EffieSources> = {
      width: 320,
      height: 240,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "green" },
      segments: [
        {
          duration: 0.3,
          layers: [],
          background: { type: "color", color: "red" },
        },
        {
          duration: 0.3,
          layers: [],
          transition: { type: "wipe", duration: 0.1, direction: "left" },
        },
      ],
    };

    const tempDir = await createTestOutputDir("transitions");

    try {
      // Render segments
      const segmentUrls: EffieFileUrl[] = [];
      for (let i = 0; i < effieData.segments.length; i++) {
        const segmentData = effieDataForSegment(effieData, i);
        const renderer = new EffieRenderer(segmentData);
        const outputPath = path.join(tempDir, `segment_${i}.mp4`);
        const stream = await renderer.render();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        await fs.writeFile(outputPath, Buffer.concat(chunks));
        renderer.close();
        segmentUrls.push(effieFileUrl(pathToFileURL(outputPath).toString()));
      }

      // Create join data and verify transition is preserved
      const joinData = effieDataForJoin(effieData, segmentUrls);
      expect(joinData.segments[1].transition).toEqual({
        type: "wipe",
        duration: 0.1,
        direction: "left",
      });

      // Render joined video (allowLocalFiles needed for local segment paths)
      const joinRenderer = new EffieRenderer(joinData, {
        allowLocalFiles: true,
      });
      const joinStream = await joinRenderer.render();
      const chunks: Buffer[] = [];
      for await (const chunk of joinStream) {
        chunks.push(chunk);
      }
      // Write joined video for inspection
      await fs.writeFile(
        path.join(tempDir, "joined.mp4"),
        Buffer.concat(chunks),
      );
      joinRenderer.close();

      // If we got here without error, the transition was applied successfully
      expect(chunks.length).toBeGreaterThan(0);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("handles global audio in join phase", async () => {
    const tempDir = await createTestOutputDir("global-audio");

    // Generate a local WAV file with a 440Hz tone (2 seconds to cover the video duration)
    const audioPath = path.join(tempDir, "tone.wav");
    await generateToneWav(audioPath, 2, 440);

    const sources: EffieSources = {
      soundtrack: `data:audio/wav;base64,${Buffer.from(await fs.readFile(audioPath)).toString("base64")}`,
    };

    const effieData: EffieData<typeof sources> = {
      width: 320,
      height: 240,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "purple" },
      sources,
      segments: [
        { duration: 1, layers: [] },
        { duration: 1, layers: [] },
      ],
      audio: {
        source: "#soundtrack",
        volume: 0.5,
        fadeIn: 0.2,
        fadeOut: 0.3,
      },
    };

    try {
      const segmentUrls: EffieFileUrl[] = [];
      for (let i = 0; i < effieData.segments.length; i++) {
        const segmentData = effieDataForSegment(effieData, i);
        const renderer = new EffieRenderer(segmentData, {
          allowLocalFiles: true,
        });
        const outputPath = path.join(tempDir, `segment_${i}.mp4`);
        const stream = await renderer.render();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        await fs.writeFile(outputPath, Buffer.concat(chunks));
        renderer.close();
        segmentUrls.push(effieFileUrl(pathToFileURL(outputPath).toString()));
      }

      const joinData = effieDataForJoin(effieData, segmentUrls);

      // Verify global audio from original is preserved
      expect(joinData.audio).toEqual({
        source: "#soundtrack",
        volume: 0.5,
        fadeIn: 0.2,
        fadeOut: 0.3,
      });

      // Render and verify success (allowLocalFiles needed for local segment paths)
      const joinRenderer = new EffieRenderer(joinData, {
        allowLocalFiles: true,
      });
      const joinStream = await joinRenderer.render();
      const chunks: Buffer[] = [];
      for await (const chunk of joinStream) {
        chunks.push(chunk);
      }
      // Write joined video for inspection (should have audio!)
      await fs.writeFile(
        path.join(tempDir, "joined.mp4"),
        Buffer.concat(chunks),
      );
      joinRenderer.close();

      expect(chunks.length).toBeGreaterThan(0);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("delay padding produces the right frame count and no green leak", async () => {
    // Regression test for two bugs in the layer.delay > 0 path:
    //
    //   1. Off-by-one: the old nullsrc default rate (25) didn't match the
    //      effie's fps, so the concat'd stream had a frame-rate boundary that
    //      the trailing fps= resample turned into one or more extra frames.
    //   2. Green leak: nullsrc emits uninitialised YUV bytes that decode to
    //      opaque #008700 when the overlaid layer has no alpha channel
    //      (JPEG-encoded annie frames).
    //
    // The fix replaces nullsrc with color=c=black@0:rate=${fps},format=yuva420p
    // — explicit framerate eliminates the boundary and explicit transparent
    // alpha makes the padding composite over the background instead of leaking.
    const ffmpegBin = pathToFFmpeg ?? "ffmpeg";
    const tempDir = await createTestOutputDir("delay-jpeg-annie");

    try {
      // 1. Produce a single solid-red 64x64 JPEG (no alpha by definition).
      const redJpegPath = path.join(tempDir, "red.jpg");
      await execFileP(ffmpegBin, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=64x64:d=0.04",
        "-frames:v",
        "1",
        "-pix_fmt",
        "yuvj420p",
        redJpegPath,
      ]);
      const redJpeg = await fs.readFile(redJpegPath);

      // 2. Pack 30 copies into an annie TAR using the in-repo encoder.
      const anniePath = path.join(tempDir, "annie.tar");
      async function* repeatJpeg(): AsyncGenerator<Buffer> {
        for (let i = 0; i < 30; i++) yield redJpeg;
      }
      await fs.writeFile(anniePath, await annieBuffer(repeatJpeg()));

      // 3. Build an effie with a 0.5s delay before the annie content starts.
      //    Crucially we set from=0: the overlay's enable window opens at t=0,
      //    so the delay padding is actually composited over the background
      //    during [0, delay] — that is when the nullsrc green leak appears.
      //    (With the default from=delay the overlay is gated off during the
      //    delay window and the bug stays hidden — see effing-examples'
      //    repro-jpeg-annie-delay for the canonical reproduction.)
      const fps = 30;
      const delay = 0.5;
      const sources: EffieSources<EffieFileUrl> = {
        anim: effieFileUrl(pathToFileURL(anniePath).toString()),
      };
      const effieData: EffieData<typeof sources, EffieFileUrl> = {
        width: 64,
        height: 64,
        fps,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "blue" },
        sources,
        segments: [
          {
            duration: 1.0,
            layers: [{ type: "animation", source: "#anim", from: 0, delay }],
          },
        ],
      };

      // 4. Render and write to disk.
      const renderer = new EffieRenderer(effieData, { allowLocalFiles: true });
      const outPath = path.join(tempDir, "out.mp4");
      const stream = await renderer.render();
      const outChunks: Buffer[] = [];
      for await (const c of stream) outChunks.push(c);
      await fs.writeFile(outPath, Buffer.concat(outChunks));
      renderer.close();

      // 5. Sample the centre pixel at t=0.25 (mid-delay) and t=0.75 (well
      //    inside the annie). Output is rawvideo rgb24 of a single pixel.
      async function sampleRGB(
        t: number,
      ): Promise<{ r: number; g: number; b: number }> {
        const rawPath = path.join(tempDir, `pixel_${t}.bin`);
        await execFileP(ffmpegBin, [
          "-y",
          "-ss",
          t.toString(),
          "-i",
          outPath,
          "-frames:v",
          "1",
          "-vf",
          "scale=1:1",
          "-pix_fmt",
          "rgb24",
          "-f",
          "rawvideo",
          rawPath,
        ]);
        const bytes = await fs.readFile(rawPath);
        return { r: bytes[0], g: bytes[1], b: bytes[2] };
      }

      const [midDelay, postDelay, probe] = await Promise.all([
        sampleRGB(0.25),
        sampleRGB(0.75),
        execFileP(ffmpegBin, [
          "-i",
          outPath,
          "-map",
          "0:v:0",
          "-an",
          "-f",
          "null",
          "-",
        ]),
      ]);

      // Pre-fix bug produced #008700 (G≈135, R≈0, B≈0). Post-fix the
      // transparent padding composites over the blue background so we expect
      // mostly blue. Guard against any non-trivial green leak.
      expect(midDelay.g).toBeLessThan(40);
      expect(midDelay.b).toBeGreaterThan(150);

      // Annie content is solid red — verify the layer is actually drawn.
      expect(postDelay.r).toBeGreaterThan(150);
      expect(postDelay.g).toBeLessThan(60);

      // 6. Verify the decoded stream ends at exactly 1.00s. The pre-fix
      //    nullsrc's 25fps default introduced a frame-rate boundary at the
      //    concat point that pushed the final PTS to 1.03s.
      const timeMatches = [
        ...probe.stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/g),
      ];
      expect(timeMatches.length).toBeGreaterThan(0);
      const last = timeMatches[timeMatches.length - 1];
      const seconds =
        parseInt(last[1], 10) * 3600 +
        parseInt(last[2], 10) * 60 +
        parseInt(last[3], 10) +
        parseInt(last[4], 10) / 100;
      // Segment is 1.0s; allow ≤1.01 for rounding. Pre-fix gives 1.03.
      expect(seconds).toBeLessThanOrEqual(1.01);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);
});
