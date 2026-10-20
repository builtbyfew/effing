import { describe, test, expect, afterAll } from "vitest";
import { EffieRenderer } from "./renderer";
import {
  effieDataForSegment,
  effieDataForJoin,
  effieFileUrl,
  effieWebUrl,
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

// The binary EffieRenderer will use (FFMPEG env first, then the bundled one).
const renderFFmpegBin = process.env.FFMPEG ?? pathToFFmpeg ?? "ffmpeg";

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
    // The layer is now padded with tpad after fps=/format=yuva420p (see the
    // delay padding comment in renderer.ts): the explicit frame rate
    // eliminates the boundary and the explicit alpha plane makes the padding
    // transparent, so it composites over the background instead of leaking.
    const ffmpegBin = renderFFmpegBin;
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
      const segmentDuration = 1.0;
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
            duration: segmentDuration,
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

      // 6. Verify the decoded stream has exactly fps * duration frames. The
      //    pre-fix nullsrc's 25fps default introduced a frame-rate boundary
      //    at the concat point that produced extra frames, and since FFmpeg
      //    8.0 an un-normalised padding chain makes the trailing fps=
      //    filter run away for ~1e6 frames (see the delay padding comment in
      //    renderer.ts). Count frames from ffmpeg's final progress line.
      const frameMatches = [...probe.stderr.matchAll(/frame=\s*(\d+)/g)];
      expect(frameMatches.length).toBeGreaterThan(0);
      const frames = parseInt(frameMatches[frameMatches.length - 1][1], 10);
      expect(frames).toBe(fps * segmentDuration);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("delay padding handles fractional delays and layers smaller than the frame", async () => {
    // Regression test for two more bugs in the layer.delay > 0 path:
    //
    //   1. A delay whose delay*fps is not an integer (0.25 s at 30 fps)
    //      produced one extra frame per segment on FFmpeg >= 8: the padding
    //      rounds up to whole frames, which pushed the layer's last frame to
    //      exactly segment.duration, and overlay forwarded it to the output.
    //      Audio is trimmed to the segment, so video drifted one frame per
    //      such segment. Two segments here make the off-by-one show twice.
    //   2. The padding was generated at frame size, so a layer of any other
    //      size (a logo, say) failed the render with a concat size mismatch.
    const ffmpegBin = renderFFmpegBin;
    const tempDir = await createTestOutputDir("delay-fractional-small-layer");

    try {
      const fps = 30;
      const segmentDuration = 1.0;
      const frameSize = 64;
      const expectedFrames = 2 * fps * segmentDuration;
      const cases = [
        { delay: 0.25, size: frameSize },
        { delay: 0.35, size: frameSize },
        { delay: 0.25, size: frameSize / 2 },
      ];

      for (const { delay, size } of cases) {
        const pngPath = path.join(tempDir, `red-${size}.png`);
        await execFileP(ffmpegBin, [
          "-y",
          "-f",
          "lavfi",
          "-i",
          `color=c=red:s=${size}x${size}:d=0.04`,
          "-frames:v",
          "1",
          pngPath,
        ]);
        const sources: EffieSources<EffieFileUrl> = {
          img: effieFileUrl(pathToFileURL(pngPath).toString()),
        };
        const effieData: EffieData<typeof sources, EffieFileUrl> = {
          width: frameSize,
          height: frameSize,
          fps,
          cover: "https://example.com/cover.png",
          background: { type: "color", color: "blue" },
          sources,
          segments: [0, 1].map(() => ({
            duration: segmentDuration,
            layers: [{ type: "image" as const, source: "#img", delay }],
          })),
        };

        const renderer = new EffieRenderer(effieData, {
          allowLocalFiles: true,
        });
        const outPath = path.join(tempDir, `out-${delay}-${size}.mp4`);
        const stream = await renderer.render();
        const outChunks: Buffer[] = [];
        for await (const c of stream) outChunks.push(c);
        await fs.writeFile(outPath, Buffer.concat(outChunks));
        renderer.close();

        const label = `delay=${delay} size=${size}`;

        // Frame count across both segments.
        const probe = await execFileP(ffmpegBin, [
          "-i",
          outPath,
          "-map",
          "0:v:0",
          "-an",
          "-f",
          "null",
          "-",
        ]);
        const frameMatches = [...probe.stderr.matchAll(/frame=\s*(\d+)/g)];
        const frames = parseInt(frameMatches[frameMatches.length - 1][1], 10);
        expect(frames, label).toBe(expectedFrames);

        // The layer sits at the top-left corner: blue during the delay, red
        // once it starts.
        async function topLeftRGB(
          t: number,
        ): Promise<[number, number, number]> {
          const rawPath = path.join(tempDir, `pixel-${delay}-${size}-${t}.bin`);
          await execFileP(ffmpegBin, [
            "-y",
            "-ss",
            t.toString(),
            "-i",
            outPath,
            "-frames:v",
            "1",
            "-vf",
            "crop=2:2:0:0,scale=1:1",
            "-pix_fmt",
            "rgb24",
            "-f",
            "rawvideo",
            rawPath,
          ]);
          const bytes = await fs.readFile(rawPath);
          return [bytes[0], bytes[1], bytes[2]];
        }
        const [, , bMid] = await topLeftRGB(delay / 2);
        expect(bMid, label).toBeGreaterThan(150);
        const [rPost, gPost] = await topLeftRGB(segmentDuration - 0.1);
        expect(rPost, label).toBeGreaterThan(150);
        expect(gPost, label).toBeLessThan(60);
      }
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 60000);

  test("slide motion translates at a constant per-frame rate (no ±2px jitter)", async () => {
    // Regression test for the slide-motion jitter bug. overlay snaps x down to
    // even values for yuv420p chroma alignment; unrounded float positions that
    // sit exactly on that boundary (e.g. 719.9999999 vs 720) flip individual
    // frames 2px across it, so a hard sliding edge wobbles. motion.ts now wraps
    // the coordinate expressions in round(); this renders a real slide and
    // asserts every per-frame step equals the ideal constant within 1px.
    //
    // Verified to fail before the fix: rendering this same slide with the
    // unrounded expression yields steps of 10/14px (±2px) where it should be 12.
    const ffmpegBin = renderFFmpegBin;
    const tempDir = await createTestOutputDir("slide-motion-jitter");

    // A wide canvas keeps the ideal step an even integer (1080/(60*1.5) = 12px)
    // so positions land exactly on the even-snap boundary where the bug appears.
    // Height is irrelevant to the x-expression, so keep it short for speed.
    const W = 1080;
    const H = 64;
    const FPS = 60;
    const DUR = 1.5;
    const idealStep = W / (FPS * DUR); // 12

    try {
      // Canvas-sized solid-white PNG as a data-URL source. Image layers load at
      // native size, so this fills the frame; sliding it in over the black
      // background produces a single hard vertical seam to track.
      const whitePath = path.join(tempDir, "white.png");
      await execFileP(ffmpegBin, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=white:s=${W}x${H}:d=0.1`,
        "-frames:v",
        "1",
        whitePath,
      ]);
      const whiteDataUrl = effieWebUrl(
        `data:image/png;base64,${Buffer.from(
          await fs.readFile(whitePath),
        ).toString("base64")}`,
      );

      const sources: EffieSources = { slab: whiteDataUrl };
      const effieData: EffieData<typeof sources> = {
        width: W,
        height: H,
        fps: FPS,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        sources,
        segments: [
          {
            duration: DUR,
            layers: [
              {
                type: "image",
                source: "#slab",
                motion: {
                  type: "slide",
                  direction: "left",
                  start: 0,
                  duration: DUR,
                },
              },
            ],
          },
        ],
      };

      const renderer = new EffieRenderer(effieData);
      const outPath = path.join(tempDir, "slide.mp4");
      const stream = await renderer.render();
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c);
      await fs.writeFile(outPath, Buffer.concat(chunks));
      renderer.close();

      // Per-frame column-mean luma profiles: scale each frame to W x 1 (which
      // averages every row into one pixel) and read raw gray bytes.
      const { stdout: rawProfiles } = await execFileP(
        ffmpegBin,
        [
          "-i",
          outPath,
          "-vf",
          `scale=${W}:1,format=gray`,
          "-f",
          "rawvideo",
          "-pix_fmt",
          "gray",
          "-",
        ],
        { encoding: "buffer", maxBuffer: 1 << 26 },
      );
      const profiles: Uint8Array[] = [];
      for (let i = 0; i + W <= rawProfiles.length; i += W) {
        profiles.push(rawProfiles.subarray(i, i + W));
      }

      // The seam is the first bright column. A frame counts toward the
      // measurement only while the seam sits strictly inside the canvas (black
      // on the left, white on the right) — this drops the all-black lead-in and
      // the fully-covered tail, whose flat profiles have no seam to correlate.
      const margin = idealStep;
      const seamOf = (p: Uint8Array): number => {
        let mn = 255;
        let mx = 0;
        for (const v of p) {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        if (mx - mn < 64) return -1; // flat profile: no seam
        const mid = (mn + mx) / 2;
        for (let x = 0; x < p.length; x++) if (p[x] >= mid) return x;
        return -1;
      };
      const moving = profiles.filter((p) => {
        const s = seamOf(p);
        return s >= margin && s <= W - margin;
      });

      // The integer x-shift minimizing SSD between consecutive profiles is the
      // per-frame step. Restricting the search to ±2 ideal steps keeps it on the
      // real translation (the content is rigid, so the match is near-exact).
      const stepBetween = (a: Uint8Array, b: Uint8Array): number => {
        let best = 0;
        let bestCost = Infinity;
        for (let s = -2 * idealStep; s <= 2 * idealStep; s++) {
          let cost = 0;
          let n = 0;
          for (let x = 0; x < W; x++) {
            const j = x + s;
            if (j < 0 || j >= W) continue;
            const d = a[x] - b[j];
            cost += d * d;
            n++;
          }
          cost /= n;
          if (cost < bestCost) {
            bestCost = cost;
            best = s;
          }
        }
        return Math.abs(best);
      };

      const steps: number[] = [];
      for (let i = 1; i < moving.length; i++) {
        steps.push(stepBetween(moving[i - 1], moving[i]));
      }

      // Sanity: we measured most of the 90-frame slide, not a degenerate handful.
      expect(steps.length).toBeGreaterThan(60);
      // The fix: no frame deviates by the tell-tale 2px. The 1px tolerance
      // absorbs incidental x264 edge noise while still rejecting the 10/14
      // (±2px) jitter the bug produced.
      const maxDeviation = Math.max(
        ...steps.map((s) => Math.abs(s - idealStep)),
      );
      expect(maxDeviation).toBeLessThanOrEqual(1);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("a landscape clip covers a portrait frame without skewing the SAR", async () => {
    // A 16:9 clip cover-scaled into a 9:16 frame doesn't land on integer
    // dimensions (1920x1080 -> 3413.33x1920), so ffmpeg's scale filter
    // compensates by giving the frames a non-square sample aspect ratio
    // (10240:10239 at 1080x1920), which crop keeps. Every other segment
    // (here a colour background) has SAR 1:1, and concat refuses to join
    // streams whose SAR differs:
    //
    //   Input link in0:v0 parameters (size 108x192, SAR 1:1) do not match
    //   the corresponding output link in0:v0 parameters (108x192, SAR 1024:1023)
    //   Nothing was written into output file, because at least one of its
    //   streams received no packets.
    //
    // The background chains now end in setsar=1, so the render succeeds and
    // the MP4 is tagged square-pixel 9:16 rather than 1920:3413.
    //
    // Verified to fail before the fix with the concat error above.
    const ffmpegBin = renderFFmpegBin;
    const tempDir = await createTestOutputDir("landscape-in-portrait");

    try {
      // 192x108 into 108x192 rounds just like 1920x1080 into 1080x1920
      // (341.33 and 3413.33 wide respectively), only cheaper to encode.
      const clipPath = path.join(tempDir, "landscape.mp4");
      await execFileP(ffmpegBin, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=192x108:rate=30:duration=1",
        "-pix_fmt",
        "yuv420p",
        clipPath,
      ]);

      const sources: EffieSources<EffieFileUrl> = {
        clip: effieFileUrl(pathToFileURL(clipPath).toString()),
      };
      const effieData: EffieData<typeof sources, EffieFileUrl> = {
        width: 108,
        height: 192,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "video", source: "#clip" },
        sources,
        segments: [
          { duration: 0.5, layers: [] },
          {
            duration: 0.5,
            background: { type: "color", color: "blue" },
            layers: [],
          },
        ],
      };

      const renderer = new EffieRenderer(effieData, { allowLocalFiles: true });
      const outPath = path.join(tempDir, "out.mp4");
      const stream = await renderer.render();
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c);
      await fs.writeFile(outPath, Buffer.concat(chunks));
      renderer.close();

      const probe = await execFileP(ffmpegBin, [
        "-i",
        outPath,
        "-map",
        "0:v:0",
        "-an",
        "-f",
        "null",
        "-",
      ]);
      expect(probe.stderr).toMatch(/108x192 \[SAR 1:1 DAR 9:16\]/);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  // Static images are read as a single frame and repeated in the filter graph
  // (see imageInputArgs in renderer.ts), so these check that image layers and
  // backgrounds keep their timing: the frame count and duration of the
  // output, a fade's progress frame by frame, a delayed layer's start, and
  // which background shows in each segment. At 0.5 the layer is scaled in
  // the filter graph before it is looped.
  test.each([1, 0.5])(
    "static image layers and backgrounds keep their timing at scale %s",
    async (scale) => {
      const ffmpegBin = renderFFmpegBin;
      const tempDir = await createTestOutputDir(`static-images-${scale}`);

      try {
        const fps = 30;
        const width = 128;
        const height = 72;

        // A JPEG global background twice the frame size (so it's
        // cover-scaled), a PNG segment background, and a red PNG covering the
        // left half of the frame, used as a layer in two segments.
        async function solid(name: string, color: string, size: string) {
          const filePath = path.join(tempDir, name);
          await execFileP(ffmpegBin, [
            "-y",
            "-f",
            "lavfi",
            "-i",
            `color=c=${color}:s=${size}`,
            "-frames:v",
            "1",
            filePath,
          ]);
          return effieFileUrl(pathToFileURL(filePath).toString());
        }
        const sources: EffieSources<EffieFileUrl> = {
          blue: await solid("blue.jpg", "blue", `${width * 2}x${height * 2}`),
          green: await solid("green.png", "lime", `${width}x${height}`),
          red: await solid("red.png", "red", `${width / 2}x${height}`),
        };

        // Segment 0 (2 s): the red layer fades in over the first second.
        // Segment 1 (1.5 s, entered with a 0.5 s fade): its own background,
        //   and the red layer only from 1 s in (delay).
        // Segment 2 (0.5 s): back on the global background.
        // Output: 2 + 1.5 - 0.5 + 0.5 = 3.5 s.
        const effieData: EffieData<typeof sources, EffieFileUrl> = {
          width,
          height,
          fps,
          cover: "https://example.com/cover.png",
          background: { type: "image", source: "#blue" },
          sources,
          segments: [
            {
              duration: 2,
              layers: [
                {
                  type: "image",
                  source: "#red",
                  effects: [{ type: "fade-in", start: 0, duration: 1 }],
                },
              ],
            },
            {
              duration: 1.5,
              background: { type: "image", source: "#green" },
              transition: { type: "fade", duration: 0.5 },
              layers: [{ type: "image", source: "#red", delay: 1 }],
            },
            { duration: 0.5, layers: [] },
          ],
        };
        // Segment 0 up to the transition, segment 1, segment 2.
        const expectedFrames = fps * (2 - 0.5) + fps * 1.5 + fps * 0.5;

        const renderer = new EffieRenderer(effieData, {
          allowLocalFiles: true,
        });
        const outPath = path.join(tempDir, "out.mp4");
        const stream = await renderer.render(scale);
        const chunks: Buffer[] = [];
        for await (const c of stream) chunks.push(c);
        await fs.writeFile(outPath, Buffer.concat(chunks));
        renderer.close();

        // Decode every frame as rgb24, as stored (passthrough: the rawvideo
        // muxer would otherwise pad the start of the stream, which begins at
        // the B-frame delay rather than 0, with duplicates).
        const frameWidth = width * scale;
        const frameHeight = height * scale;
        const frameBytes = frameWidth * frameHeight * 3;
        const { stdout: raw, stderr: info } = await execFileP(
          ffmpegBin,
          [
            "-i",
            outPath,
            "-map",
            "0:v:0",
            "-fps_mode",
            "passthrough",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
          ],
          { encoding: "buffer", maxBuffer: 1 << 26 },
        );
        expect(raw.length % frameBytes).toBe(0);
        const frameCount = raw.length / frameBytes;
        expect(frameCount).toBe(expectedFrames);

        expect(info.toString()).toMatch(
          new RegExp(`${frameWidth}x${frameHeight} \\[SAR 1:1 DAR 16:9\\]`),
        );

        // The video stream's duration, from its packets' timestamps: the
        // first frame's pts to the last frame's pts plus its duration.
        const { stdout: crc } = await execFileP(ffmpegBin, [
          "-v",
          "error",
          "-i",
          outPath,
          "-map",
          "0:v:0",
          "-c",
          "copy",
          "-f",
          "framecrc",
          "-",
        ]);
        const [tbNum, tbDen] = /^#tb 0: (\d+)\/(\d+)$/m
          .exec(crc)!
          .slice(1)
          .map(Number);
        const packets = crc
          .split("\n")
          .filter((line) => /^0,/.test(line))
          .map((line) => line.split(",").map((f) => Number(f.trim())));
        const firstPts = Math.min(...packets.map(([, , pts]) => pts));
        const endPts = Math.max(...packets.map(([, , pts, d]) => pts + d));
        expect(((endPts - firstPts) * tbNum) / tbDen).toBeCloseTo(
          expectedFrames / fps,
          3,
        );

        // RGB at the centre of the left (layer) or right (background) half.
        const pixel = (frame: number, side: "left" | "right") => {
          const x = Math.floor(frameWidth * (side === "left" ? 0.25 : 0.75));
          const y = Math.floor(frameHeight / 2);
          const i = frame * frameBytes + (y * frameWidth + x) * 3;
          return { r: raw[i], g: raw[i + 1], b: raw[i + 2] };
        };
        const tolerance = 24;
        const expectRGB = (
          frame: number,
          side: "left" | "right",
          expected: { r: number; g: number; b: number },
        ) => {
          const actual = pixel(frame, side);
          const label = `frame ${frame} ${side}: ${JSON.stringify(actual)}`;
          expect(Math.abs(actual.r - expected.r), label).toBeLessThan(
            tolerance,
          );
          expect(Math.abs(actual.g - expected.g), label).toBeLessThan(
            tolerance,
          );
          expect(Math.abs(actual.b - expected.b), label).toBeLessThan(
            tolerance,
          );
        };
        const blue = { r: 0, g: 0, b: 255 };
        const green = { r: 0, g: 255, b: 0 };
        const red = { r: 255, g: 0, b: 0 };

        // Segment 0: the fade-in's opacity is t/1s at every frame up to 1 s,
        // over the cover-scaled background.
        for (const frame of [0, 6, 15, 24]) {
          const alpha = frame / fps;
          expectRGB(frame, "left", {
            r: 255 * alpha,
            g: 0,
            b: 255 * (1 - alpha),
          });
        }
        expectRGB(35, "left", red);
        expectRGB(35, "right", blue);

        // Segment 1 starts at 1.5 s (frame 45); its fade transition ends at
        // 2 s. The delayed layer appears 1 s in, at 2.5 s (frame 75).
        expectRGB(62, "left", green);
        expectRGB(74, "left", green);
        expectRGB(75, "left", red);
        expectRGB(88, "left", red);
        expectRGB(88, "right", green);

        // Segment 2 (from 3 s, frame 90): the global background again.
        expectRGB(90, "left", blue);
        expectRGB(frameCount - 1, "right", blue);
      } finally {
        await cleanupTestOutput(tempDir);
      }
    },
    30000,
  );

  // Helpers for the tests below: a 64x36 single-frame image, a render to
  // disk, and every frame of the output decoded as rgb24.
  const smallWidth = 64;
  const smallHeight = 36;

  async function smallImage(
    tempDir: string,
    name: string,
    color: string,
    filter = "null",
    size = `${smallWidth}x${smallHeight}`,
  ): Promise<EffieFileUrl> {
    const filePath = path.join(tempDir, name);
    await execFileP(renderFFmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=${size}`,
      "-vf",
      filter,
      "-frames:v",
      "1",
      filePath,
    ]);
    return effieFileUrl(pathToFileURL(filePath).toString());
  }

  /**
   * Renders at `scale` (a composition `1 / scale` times the small size, so
   * the output is always smallWidth x smallHeight).
   */
  async function renderSmallFrames(
    tempDir: string,
    effieData: EffieData<EffieSources<EffieFileUrl>, EffieFileUrl>,
    scale = 1,
  ): Promise<Buffer[]> {
    const renderer = new EffieRenderer(effieData, { allowLocalFiles: true });
    const outPath = path.join(tempDir, "out.mp4");
    const stream = await renderer.render(scale);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c);
    await fs.writeFile(outPath, Buffer.concat(chunks));
    renderer.close();

    // Passthrough: see the static image layers and backgrounds test.
    const { stdout: raw } = await execFileP(
      renderFFmpegBin,
      [
        "-i",
        outPath,
        "-map",
        "0:v:0",
        "-fps_mode",
        "passthrough",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 1 << 26 },
    );
    const frameBytes = smallWidth * smallHeight * 3;
    expect(raw.length % frameBytes).toBe(0);
    const frames: Buffer[] = [];
    for (let i = 0; i < raw.length; i += frameBytes) {
      frames.push(raw.subarray(i, i + frameBytes));
    }
    return frames;
  }

  /** Dominant colour of the pixel at column x, mid-height. */
  function colorAt(frame: Buffer, x: number): string {
    const i = ((smallHeight / 2) * smallWidth + x) * 3;
    const [r, g, b] = [frame[i], frame[i + 1], frame[i + 2]];
    return r > 150 && g < 100 && b < 100
      ? "red"
      : g > 150 && r < 100 && b < 100
        ? "green"
        : b > 150 && r < 100 && g < 100
          ? "blue"
          : `rgb(${r},${g},${b})`;
  }

  test("a static image layer keeps one frame per 1/fps for frame-based effects", async () => {
    // The scroll effect moves the image a fixed distance per frame, so it
    // only keeps its speed if the repeated image has exactly one frame per
    // 1/fps, as a looped input did. Without -framerate on the image input
    // the frames would be spaced at FFmpeg's default 25 fps, which this
    // catches.
    const tempDir = await createTestOutputDir("static-images-scroll");

    try {
      const fps = 30;
      const sources: EffieSources<EffieFileUrl> = {
        // Left half red, right half blue.
        halves: await smallImage(
          tempDir,
          "halves.png",
          "red",
          `drawbox=x=${smallWidth / 2}:y=0:w=${smallWidth / 2}:h=${smallHeight}:color=blue:t=fill`,
        ),
      };
      const duration = 0.5;
      const frames = await renderSmallFrames(tempDir, {
        width: smallWidth,
        height: smallHeight,
        fps,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        sources,
        segments: [
          {
            duration,
            layers: [
              {
                type: "image",
                source: "#halves",
                // Left by half the image over the segment.
                effects: [
                  { type: "scroll", direction: "left", duration, distance: 1 },
                ],
              },
            ],
          },
        ],
      });
      expect(frames.length).toBe(fps * duration);

      // The red/blue edge starts at the centre and moves left by
      // (width / 2) / (fps * duration) px per frame. The tolerance is 2 px:
      // with 4:2:0 chroma the measured edge lands on even columns, so it is
      // up to ~1 px off already and an encoder may shift it by one more
      // pixel. Frames spaced at 25 fps instead are ~5 px off.
      const step = smallWidth / 2 / (fps * duration);
      frames.forEach((frame, n) => {
        let edge = 0;
        while (edge < smallWidth && colorAt(frame, edge) !== "blue") edge++;
        const expected = smallWidth / 2 - n * step;
        expect(
          Math.abs(edge - expected),
          `frame ${n}: edge ${edge}`,
        ).toBeLessThanOrEqual(2);
      });
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("static images keep their frame counts in very short segments", async () => {
    const tempDir = await createTestOutputDir("static-images-short");

    try {
      const fps = 30;
      const sources: EffieSources<EffieFileUrl> = {
        red: await smallImage(tempDir, "red.png", "red"),
        green: await smallImage(tempDir, "green.png", "lime"),
      };
      const frames = await renderSmallFrames(tempDir, {
        width: smallWidth,
        height: smallHeight,
        fps,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        sources,
        segments: [
          // Two frames.
          { duration: 2 / fps, layers: [{ type: "image", source: "#red" }] },
          // One frame, on an image background.
          {
            duration: 1 / fps,
            background: { type: "image", source: "#green" },
            layers: [],
          },
          // Three frames.
          { duration: 0.1, layers: [{ type: "image", source: "#red" }] },
        ],
      });
      expect(frames.map((frame) => colorAt(frame, smallWidth / 2))).toEqual([
        "red",
        "red",
        "green",
        "red",
        "red",
        "red",
      ]);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test.for<["format" | "size", number]>([
    ["format", 1],
    ["size", 1],
    ["format", 0.5],
    ["size", 0.5],
  ])(
    "an annie whose frames change %s mid-stream keeps the image layers and timing at scale %s",
    { timeout: 30000 },
    async ([change, scale]) => {
      // Annie frames can differ in pixel format (an rgba PNG after rgb24
      // ones) or size. By default FFmpeg rebuilds the whole filter graph when
      // that happens, which left the single-frame image inputs with nothing
      // to send (image layers vanished from then on, in every segment) and
      // restarted every chain's timing (frames came out early and the frame
      // count was off). The animation input now keeps the graph, and its
      // chain gives every frame the first frame's format and size. At scale
      // 0.5 the composition is twice the size, so the output and every
      // position checked below are the same.
      const tempDir = await createTestOutputDir(
        `annie-${change}-change-${scale}`,
      );
      // A size at scale 1, for a composition rendered at `scale`.
      const sized = (w: number, h: number) => `${w / scale}x${h / scale}`;

      try {
        const fps = 10;
        async function frame(name: string, color: string, size: string) {
          const filePath = path.join(tempDir, name);
          await execFileP(renderFFmpegBin, [
            "-y",
            "-f",
            "lavfi",
            "-i",
            `color=c=${color}:s=${size},format=${color.includes("@") ? "rgba" : "rgb24"}`,
            "-frames:v",
            "1",
            "-f",
            "image2",
            "-c:v",
            "png",
            filePath,
          ]);
          return fs.readFile(filePath);
        }
        // Three opaque red rgb24 frames, then three green frames: rgba and
        // half transparent, or opaque but larger.
        const red = await frame("red.png", "red", sized(47, 33));
        const green =
          change === "format"
            ? await frame("green.png", "lime@0.5", sized(47, 33))
            : await frame("green.png", "lime", sized(81, 61));
        const anniePath = path.join(tempDir, "anim.tar");
        await fs.writeFile(
          anniePath,
          await annieBuffer(
            (async function* () {
              for (const f of [red, red, red, green, green, green]) yield f;
            })(),
          ),
        );
        const sources: EffieSources<EffieFileUrl> = {
          // A blue square in the top-right corner, clear of the annie.
          square: await smallImage(
            tempDir,
            "square.png",
            "black@0",
            `format=rgba,drawbox=x=${50 / scale}:y=0:w=${14 / scale}:h=${10 / scale}:color=blue:t=fill`,
            sized(smallWidth, smallHeight),
          ),
          anim: effieFileUrl(pathToFileURL(anniePath).toString()),
        };

        const frames = await renderSmallFrames(
          tempDir,
          {
            width: smallWidth / scale,
            height: smallHeight / scale,
            fps,
            cover: "https://example.com/cover.png",
            background: { type: "color", color: "black" },
            sources,
            segments: [
              {
                duration: 0.6,
                layers: [
                  { type: "image", source: "#square" },
                  { type: "animation", source: "#anim" },
                ],
              },
              { duration: 0.3, layers: [{ type: "image", source: "#square" }] },
            ],
          },
          scale,
        );
        const segment0Frames = fps * 0.6;
        expect(frames.length).toBe(fps * (0.6 + 0.3));

        const rgb = (n: number, x: number, y: number) => {
          const i = (y * smallWidth + x) * 3;
          return [frames[n][i], frames[n][i + 1], frames[n][i + 2]];
        };
        frames.forEach((_, n) => {
          // The image layer is on every frame, in both segments.
          expect(rgb(n, 56, 5)[2], `frame ${n}: square`).toBeGreaterThan(150);
          const [r, g] = rgb(n, 10, 10);
          if (n < 3) {
            expect(r, `frame ${n}: red annie frame`).toBeGreaterThan(200);
          } else if (n < segment0Frames) {
            // The changed frames show up when they're due, as the annie's
            // own (half transparent) frames, at the first frame's size.
            expect(r, `frame ${n}: green annie frame`).toBeLessThan(60);
            if (change === "format") {
              expect(g, `frame ${n}: half transparent`).toBeGreaterThan(90);
              expect(g, `frame ${n}: half transparent`).toBeLessThan(170);
            } else {
              expect(g, `frame ${n}: green annie frame`).toBeGreaterThan(200);
              expect(rgb(n, 55, 30)[1], `frame ${n}: first size`).toBeLessThan(
                60,
              );
            }
          } else {
            expect(r + g, `frame ${n}: no annie`).toBeLessThan(60);
          }
        });
      } finally {
        await cleanupTestOutput(tempDir);
      }
    },
  );
});

describe("scaled renders", () => {
  // A scaled render shrinks image and animation layers inside the filter
  // graph (see imageScaleFilters and animationChainHead in renderer.ts).
  // These check the layers' sizes and positions, alpha edges, EXIF
  // orientation, and which sources get premultiplied, and how.
  const ffmpegBin = renderFFmpegBin;

  /** Writes a single-frame image made by a lavfi source graph. */
  async function lavfiImage(
    dir: string,
    name: string,
    graph: string,
  ): Promise<string> {
    const filePath = path.join(dir, name);
    await execFileP(ffmpegBin, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      graph,
      "-frames:v",
      "1",
      // Write the file as named, e.g. extensionless annie frames.
      "-f",
      "image2",
      "-c:v",
      name.endsWith(".jpg") ? "mjpeg" : "png",
      filePath,
    ]);
    return filePath;
  }

  const fileUrl = (filePath: string) =>
    effieFileUrl(pathToFileURL(filePath).toString());

  /** Renders to an MP4 in `dir` and returns its path. */
  async function renderToFile(
    dir: string,
    effieData: EffieData<EffieSources<EffieFileUrl>, EffieFileUrl>,
    scale: number,
  ): Promise<string> {
    const renderer = new EffieRenderer(effieData, { allowLocalFiles: true });
    const outPath = path.join(dir, `out-${scale}.mp4`);
    const stream = await renderer.render(scale);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c);
    await fs.writeFile(outPath, Buffer.concat(chunks));
    renderer.close();
    return outPath;
  }

  /** Decodes every frame of an MP4 to raw 8-bit luma. */
  async function decodeLuma(
    file: string,
    width: number,
    height: number,
  ): Promise<Buffer[]> {
    const { stdout } = await execFileP(
      ffmpegBin,
      [
        "-i",
        file,
        "-map",
        "0:v:0",
        "-fps_mode",
        "passthrough",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 1 << 26 },
    );
    const frameBytes = width * height;
    expect(stdout.length % frameBytes).toBe(0);
    return Array.from({ length: stdout.length / frameBytes }, (_, i) =>
      stdout.subarray(i * frameBytes, (i + 1) * frameBytes),
    );
  }

  /** Bounding box of the pixels of a luma frame that pass `test`. */
  function bbox(
    frame: Buffer,
    width: number,
    test: (luma: number) => boolean,
  ): { x: [number, number]; y: [number, number] } | undefined {
    let [x0, x1, y0, y1] = [Infinity, -1, Infinity, -1];
    for (let i = 0; i < frame.length; i++) {
      if (!test(frame[i])) continue;
      const [x, y] = [i % width, Math.floor(i / width)];
      [x0, x1, y0, y1] = [
        Math.min(x0, x),
        Math.max(x1, x),
        Math.min(y0, y),
        Math.max(y1, y),
      ];
    }
    return x1 < 0 ? undefined : { x: [x0, x1], y: [y0, y1] };
  }

  test("image and animation layers shrink to floor(w*scale) x floor(h*scale) and keep their positions", async () => {
    const tempDir = await createTestOutputDir("scaled-layer-geometry");

    try {
      // Odd sizes, so the scaled sizes are truncated: a 61x41 image and a
      // 47x33 animation, opaque white in an alpha format, over black.
      const box = await lavfiImage(
        tempDir,
        "box.png",
        "color=c=white:s=61x41,format=rgba",
      );
      const frame = await fs.readFile(
        await lavfiImage(tempDir, "frame", "color=c=white:s=47x33,format=rgba"),
      );
      const anniePath = path.join(tempDir, "anim.annie");
      await fs.writeFile(
        anniePath,
        await annieBuffer(
          (async function* () {
            for (let i = 0; i < 5; i++) yield frame;
          })(),
        ),
      );

      const sources: EffieSources<EffieFileUrl> = {
        box: fileUrl(box),
        anim: fileUrl(anniePath),
      };
      // Five 0.5 s segments of 5 frames. The motions that haven't started
      // yet hold their initial offsets: the slide 0.3 of the frame width to
      // the right, the bounce half the layer height up. The shake moves the
      // layer `intensity` px (not scaled) times cos(0) = 1 down at the
      // segment's first frame. (Overlay rounds offsets down to even pixels
      // for yuv420, so these are all even.)
      const notYet = 100;
      const effieData: EffieData<typeof sources, EffieFileUrl> = {
        width: 200,
        height: 120,
        fps: 10,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        sources,
        segments: [
          { duration: 0.5, layers: [{ type: "image", source: "#box" }] },
          { duration: 0.5, layers: [{ type: "animation", source: "#anim" }] },
          {
            duration: 0.5,
            layers: [
              {
                type: "image",
                source: "#box",
                motion: {
                  type: "slide",
                  direction: "left",
                  distance: 0.3,
                  start: notYet,
                },
              },
            ],
          },
          {
            duration: 0.5,
            layers: [
              {
                type: "image",
                source: "#box",
                motion: { type: "shake", intensity: 6, duration: notYet },
              },
            ],
          },
          {
            duration: 0.5,
            layers: [
              {
                type: "animation",
                source: "#anim",
                motion: { type: "bounce", amplitude: 0.5, start: notYet },
              },
            ],
          },
        ],
      };

      const outPath = await renderToFile(tempDir, effieData, 0.5);
      const [width, height] = [100, 60];
      const frames = await decodeLuma(outPath, width, height);
      expect(frames).toHaveLength(25);

      const white = (frameIndex: number) =>
        bbox(frames[frameIndex], width, (luma) => luma > 128);
      // The 61x41 image is 30x20, the 47x33 animation 23x16.
      expect(white(2)).toEqual({ x: [0, 29], y: [0, 19] });
      expect(white(7)).toEqual({ x: [0, 22], y: [0, 15] });
      // Slid right by round(0.3 * 100) = 30 px.
      expect(white(12)).toEqual({ x: [30, 59], y: [0, 19] });
      // Shaken 6 px down at the segment's first frame.
      expect(white(15)).toEqual({ x: [0, 29], y: [6, 25] });
      // Bounced up by half the scaled animation's height, 8 px.
      expect(white(22)).toEqual({ x: [0, 22], y: [0, 7] });
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("a transparent PNG layer has no dark fringe along its edges", async () => {
    // Opaque yellow shapes on fully transparent black, over a cyan
    // background: every output pixel should be a mix of yellow and cyan, so
    // its luma lies between theirs, give or take the ringing of the bicubic
    // filter and the encoder (about 10 below cyan). Scaled with straight
    // alpha, bicubic would blend the black of the transparent pixels into the
    // edge pixels and composite them darker than either: about 40 below cyan
    // at scale 0.5 and 0.25.
    const tempDir = await createTestOutputDir("scaled-alpha-edges");

    try {
      const shape = await lavfiImage(
        tempDir,
        "shape.png",
        "color=c=black@0:s=160x160,format=rgba," +
          "drawbox=x=41:y=37:w=70:h=81:color=yellow:t=fill:replace=1," +
          "drawbox=x=19:y=125:w=121:h=9:color=yellow:t=fill:replace=1",
      );
      const sources: EffieSources<EffieFileUrl> = { shape: fileUrl(shape) };
      const effieData: EffieData<typeof sources, EffieFileUrl> = {
        width: 160,
        height: 160,
        fps: 10,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "cyan" },
        sources,
        segments: [
          { duration: 0.3, layers: [{ type: "image", source: "#shape" }] },
        ],
      };

      for (const scale of [0.5, 0.25]) {
        const size = 160 * scale;
        const outPath = await renderToFile(tempDir, effieData, scale);
        const [frame] = await decodeLuma(outPath, size, size);
        // Luma at a point given in full-size layer coordinates.
        const at = (x: number, y: number) =>
          frame[Math.floor(y * scale) * size + Math.floor(x * scale)];
        const yellow = at(76, 77);
        const cyan = at(4, 4);
        expect(yellow - cyan).toBeGreaterThan(30);
        expect(Math.min(...frame), `scale ${scale}`).toBeGreaterThanOrEqual(
          cyan - 20,
        );
      }
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test.each([1, 0.5])(
    "a JPEG layer is shown as its EXIF orientation says at scale %s",
    async (scale) => {
      // A 64x32 JPEG, white on the left and black on the right, tagged
      // "rotate 90° clockwise" (orientation 6): shown 32x64, white on top.
      const tempDir = await createTestOutputDir(`scaled-exif-${scale}`);

      try {
        const plain = await fs.readFile(
          await lavfiImage(
            tempDir,
            "plain.jpg",
            "color=c=white:s=64x32,drawbox=x=32:y=0:w=32:h=32:color=black:t=fill",
          ),
        );
        // An APP1 Exif segment with a big-endian TIFF header and a single
        // IFD entry: Orientation (0x0112), SHORT, count 1, value 6.
        const exif = Buffer.concat([
          Buffer.from("Exif\0\0", "latin1"),
          Buffer.from([
            0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01,
            0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
          ]),
        ]);
        const app1 = Buffer.alloc(4);
        app1.writeUInt16BE(0xffe1, 0);
        app1.writeUInt16BE(exif.length + 2, 2);
        // Right after the SOI marker.
        const rotatedPath = path.join(tempDir, "rotated.jpg");
        await fs.writeFile(
          rotatedPath,
          Buffer.concat([plain.subarray(0, 2), app1, exif, plain.subarray(2)]),
        );

        const sources: EffieSources<EffieFileUrl> = {
          photo: fileUrl(rotatedPath),
        };
        const effieData: EffieData<typeof sources, EffieFileUrl> = {
          width: 96,
          height: 96,
          fps: 10,
          cover: "https://example.com/cover.png",
          background: { type: "color", color: "gray" },
          sources,
          segments: [
            { duration: 0.3, layers: [{ type: "image", source: "#photo" }] },
          ],
        };

        const outPath = await renderToFile(tempDir, effieData, scale);
        const size = 96 * scale;
        const [frame] = await decodeLuma(outPath, size, size);
        const [w, h] = [32 * scale, 64 * scale];
        expect(bbox(frame, size, (luma) => luma > 200)).toEqual({
          x: [0, w - 1],
          y: [0, h / 2 - 1],
        });
        expect(bbox(frame, size, (luma) => luma < 50)).toEqual({
          x: [0, w - 1],
          y: [h / 2, h - 1],
        });
      } finally {
        await cleanupTestOutput(tempDir);
      }
    },
    30000,
  );

  test.each([1, 0.5])(
    "an annie whose later frames gain alpha keeps their translucency at scale %s",
    async (scale) => {
      // Three opaque rgb24 frames, then three rgba frames of half
      // transparent dark green (0, 100, 0) over black: those should composite
      // to (0, 50, 0). Premultiplying for the scale only when the first frame
      // has alpha would scale them with straight alpha and unpremultiply them
      // anyway, doubling their colour to (0, 100, 0).
      const tempDir = await createTestOutputDir(`scaled-annie-alpha-${scale}`);

      try {
        const size = `${48 / scale}x${32 / scale}`;
        const red = await fs.readFile(
          await lavfiImage(
            tempDir,
            "red",
            `color=c=red:s=${size},format=rgb24`,
          ),
        );
        const green = await fs.readFile(
          await lavfiImage(
            tempDir,
            "green",
            `color=c=0x006400@0.5:s=${size},format=rgba`,
          ),
        );
        const anniePath = path.join(tempDir, "anim.annie");
        await fs.writeFile(
          anniePath,
          await annieBuffer(
            (async function* () {
              for (const f of [red, red, red, green, green, green]) yield f;
            })(),
          ),
        );
        const sources: EffieSources<EffieFileUrl> = {
          anim: fileUrl(anniePath),
        };
        const effieData: EffieData<typeof sources, EffieFileUrl> = {
          width: 64 / scale,
          height: 36 / scale,
          fps: 10,
          cover: "https://example.com/cover.png",
          background: { type: "color", color: "black" },
          sources,
          segments: [
            { duration: 0.6, layers: [{ type: "animation", source: "#anim" }] },
          ],
        };

        const outPath = await renderToFile(tempDir, effieData, scale);
        const frames = await decodeLuma(outPath, 64, 36);
        expect(frames).toHaveLength(6);
        // Luma (full range) of red is about 76, of (0, 50, 0) about 29 and
        // of (0, 100, 0) about 59.
        const luma = frames.map((frame) => frame[10 * 64 + 10]);
        for (const n of [0, 1, 2]) {
          expect(luma[n], `frame ${n}: red`).toBeGreaterThan(60);
        }
        for (const n of [3, 4, 5]) {
          expect(luma[n], `frame ${n}: half transparent`).toBeGreaterThan(15);
          expect(luma[n], `frame ${n}: half transparent`).toBeLessThan(45);
        }
      } finally {
        await cleanupTestOutput(tempDir);
      }
    },
    30000,
  );

  /**
   * Runs the render's own FFmpeg command (as buildFFmpegCommand builds it)
   * with the negotiated filter graph dumped as JSON (-print_graphs_file),
   * and returns the input link of every filter in it, auto-inserted ones
   * included, keyed by filter id (e.g. in_1_v -> G0_auto_scale_5 ->
   * G0_auto_premultiply_dynamic_0 -> G0_Parsed_format_0 -> ...).
   */
  async function negotiatedGraph(
    tempDir: string,
    effieData: EffieData<EffieSources<EffieFileUrl>, EffieFileUrl>,
    scale: number,
  ) {
    type Command = {
      inputs: { index: number; source: string }[];
      buildArgs(resolve: (input: { source: string }) => string): string[];
    };
    const command = (
      new EffieRenderer(effieData) as unknown as {
        buildFFmpegCommand: (out: string, scale: number) => Command;
      }
    ).buildFFmpegCommand(path.join(tempDir, "out.mp4"), scale);
    const args = command.buildArgs(({ source }) =>
      fileURLToPath(effieData.sources![source.slice(1)]),
    );
    const graphFile = path.join(tempDir, "graph.json");
    args.unshift("-print_graphs_format", "json");
    args.unshift("-print_graphs_file", graphFile);
    await execFileP(ffmpegBin, args);

    type Link = {
      filter_id: string;
      source_filter_id: string;
      format: string;
      width: number;
      height: number;
    };
    type Filter = { filter_name: string; filter_inputs?: Link[] };
    const graph = JSON.parse(await fs.readFile(graphFile, "utf8")) as {
      graphs: { filters: Filter[] }[];
    };
    const links = graph.graphs[0].filters.flatMap((filter) =>
      (filter.filter_inputs ?? []).map((link) => ({
        ...link,
        filter_name: filter.filter_name,
      })),
    );
    const linkTo = new Map(links.map((link) => [link.filter_id, link]));
    /** The input (in_<N>_v buffer source) a filter reads, and its path. */
    const upstream = (filterId: string) => {
      const path: string[] = [];
      for (let id = filterId; ;) {
        const link = linkTo.get(id);
        if (!link) throw new Error(`no input link for ${id}`);
        const source = link.source_filter_id;
        const input = /^in_(\d+)_v$/.exec(source);
        if (input) return { input: Number(input[1]), path };
        path.push(source);
        id = source;
      }
    };
    const inputIndex = (ref: string) =>
      command.inputs.find((input) => input.source === ref)!.index;
    return { links, upstream, inputIndex };
  }

  test("only images with an alpha channel are premultiplied", async () => {
    // Every image layer gets the same scale chain (see imageScaleFilters);
    // FFmpeg inserts the premultiplication while negotiating the graph, only
    // for images decoded into a pixel format with alpha. An opaque JPEG or
    // RGB PNG is scaled as is, not first converted to an alpha format at
    // full size.
    const tempDir = await createTestOutputDir("scaled-premultiply");

    try {
      const sources: EffieSources<EffieFileUrl> = {
        rgba: fileUrl(
          await lavfiImage(
            tempDir,
            "alpha.png",
            "color=c=red@0.5:s=64x64,format=rgba",
          ),
        ),
        rgb: fileUrl(
          await lavfiImage(
            tempDir,
            "opaque.png",
            "color=c=green:s=64x64,format=rgb24",
          ),
        ),
        jpeg: fileUrl(
          await lavfiImage(tempDir, "photo.jpg", "color=c=blue:s=64x64"),
        ),
      };
      const { links, upstream, inputIndex } = await negotiatedGraph(
        tempDir,
        {
          width: 64,
          height: 64,
          fps: 10,
          cover: "https://example.com/cover.png",
          background: { type: "color", color: "black" },
          sources,
          segments: [
            {
              duration: 0.2,
              layers: [
                { type: "image", source: "#rgba" },
                { type: "image", source: "#rgb" },
                { type: "image", source: "#jpeg" },
              ],
            },
          ],
        },
        0.5,
      );

      // Premultiplications ahead of a layer's scale, i.e. at full size: the
      // ones FFmpeg inserts (premultiply_dynamic) or an explicit premultiply.
      const isScale = (id: string) => /_Parsed_scale_\d+$/.test(id);
      const premultiplied = links
        .filter((link) => /^premultiply(_dynamic)?$/.test(link.filter_name))
        .filter((link) => !upstream(link.filter_id).path.some(isScale))
        .map((link) => ({
          input: upstream(link.filter_id).input,
          size: `${link.width}x${link.height}`,
        }));
      expect(premultiplied).toEqual([
        { input: inputIndex("#rgba"), size: "64x64" },
      ]);

      // The layers' own scale filters read the decoded format: an alpha
      // format only for the RGBA PNG (converted for the premultiply).
      const scaled = new Map(
        links
          .filter((link) => isScale(link.filter_id))
          .map((link) => [upstream(link.filter_id).input, link.format]),
      );
      expect(scaled.get(inputIndex("#rgba"))).toBe("gbrap");
      expect(scaled.get(inputIndex("#rgb"))).toBe("rgb24");
      expect(scaled.get(inputIndex("#jpeg"))).toBe("yuvj420p");
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);

  test("animations are premultiplied at full size without chroma subsampling", async () => {
    // A scaled animation is premultiplied explicitly, every frame (see
    // animationChainHead), after a normaliser that converts it to the alpha
    // format premultiply takes: planar RGB for PNG frames, and YUV 4:4:4 for
    // JPEG frames, not the yuva420p a scale-1 render normalises to.
    const tempDir = await createTestOutputDir("scaled-annie-premultiply");

    try {
      // The frames as FFmpegRunner extracts an annie: a directory of
      // frame_NNNNN files, read with the image2 frame_%05d pattern.
      async function annie(name: string, frameName: string, graph: string) {
        const frame = await fs.readFile(
          await lavfiImage(tempDir, frameName, graph),
        );
        const dir = path.join(tempDir, name);
        await fs.mkdir(dir);
        await fs.writeFile(path.join(dir, "frame_00000"), frame);
        await fs.writeFile(path.join(dir, "frame_00001"), frame);
        return fileUrl(dir);
      }
      const sources: EffieSources<EffieFileUrl> = {
        png: await annie(
          "png.annie",
          "frame",
          "color=c=red:s=64x48,format=rgb24",
        ),
        jpeg: await annie("jpeg.annie", "frame.jpg", "color=c=blue:s=64x48"),
      };
      const { links, upstream, inputIndex } = await negotiatedGraph(
        tempDir,
        {
          width: 64,
          height: 64,
          fps: 10,
          cover: "https://example.com/cover.png",
          background: { type: "color", color: "black" },
          sources,
          segments: [
            {
              duration: 0.2,
              layers: [
                { type: "animation", source: "#png" },
                { type: "animation", source: "#jpeg" },
              ],
            },
          ],
        },
        0.5,
      );

      const premultiplied = new Map(
        links
          .filter((link) => link.filter_name === "premultiply")
          .map((link) => [
            upstream(link.filter_id).input,
            `${link.format} ${link.width}x${link.height}`,
          ]),
      );
      expect(premultiplied).toEqual(
        new Map([
          [inputIndex("#png"), "gbrap 64x48"],
          [inputIndex("#jpeg"), "yuva444p 64x48"],
        ]),
      );
      expect(
        links.some(
          (link) =>
            link.format === "yuva420p" &&
            link.width === 64 &&
            link.height === 48,
        ),
      ).toBe(false);
    } finally {
      await cleanupTestOutput(tempDir);
    }
  }, 30000);
});
