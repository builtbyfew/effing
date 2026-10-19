import { describe, test, expect, vi } from "vitest";
import {
  FFmpegCommand,
  FFmpegRunner,
  isSupportedFFmpegVersion,
} from "./ffmpeg";
import { Readable } from "stream";
import { finished } from "stream/promises";
import fsp from "fs/promises";
import tar from "tar-stream";

// The runner reports ffmpeg's exit through its output stream, which can
// happen after a test body returns. Consume the stream and wait for it to
// settle so the expected failure (ffmpeg choking on the garbage test
// inputs) lands here instead of failing the run as an unhandled error.
async function runUntilSettled(
  runner: FFmpegRunner,
  ...args: Parameters<FFmpegRunner["run"]>
) {
  try {
    const output = await runner.run(...args);
    output.resume();
    runner.close();
    await finished(output);
  } catch (err) {
    // Only the ffmpeg failure is expected — these tests assert on source
    // fetching, which happens before ffmpeg spawns. Anything else is a
    // genuine bug and must fail the test.
    if (!(err instanceof Error) || !/^ffmpeg exited with/.test(err.message)) {
      throw err;
    }
  } finally {
    runner.close();
  }
}

describe("FFmpegRunner", () => {
  describe("source caching", () => {
    test("caches #reference sources to avoid duplicate fetches", async () => {
      const fetchedSources: string[] = [];
      const sourceFetcher = vi.fn().mockImplementation(async ({ src }) => {
        fetchedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // referenceResolver maps #refs to URLs
      const referenceResolver = (src: string) => {
        if (src === "#__segment_0") return "https://example.com/segment0.mp4";
        if (src === "#__segment_1") return "https://example.com/segment1.mp4";
        return src;
      };

      // Simulate what effieDataForJoin produces: same #reference for background and audio
      const command = new FFmpegCommand(
        ["-y"],
        [
          { index: 0, source: "#__segment_0", preArgs: [], type: "image" }, // Use image type to ensure fetching
          { index: 1, source: "#__segment_0", preArgs: [], type: "image" }, // Same source!
          { index: 2, source: "#__segment_1", preArgs: [], type: "image" },
          { index: 3, source: "#__segment_1", preArgs: [], type: "image" }, // Same source!
        ],
        "[0:v][1:v]overlay[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      // The run will fail when FFmpeg tries to spawn, but source resolution happens first
      await runUntilSettled(runner, sourceFetcher, referenceResolver);

      // Should only be called twice (once per unique #reference), not 4 times
      expect(sourceFetcher).toHaveBeenCalledTimes(2);
      // sourceFetcher receives resolved URLs, not #refs
      expect(fetchedSources).toContain("https://example.com/segment0.mp4");
      expect(fetchedSources).toContain("https://example.com/segment1.mp4");
    });

    test("passes HTTP video/audio URLs directly to FFmpeg without fetching", async () => {
      const fetchedSources: string[] = [];
      const sourceFetcher = vi.fn().mockImplementation(async ({ src }) => {
        fetchedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // HTTP(S) video/audio URLs should be passed directly to FFmpeg
      const command = new FFmpegCommand(
        ["-y"],
        [
          {
            index: 0,
            source: "https://example.com/video.mp4",
            preArgs: [],
            type: "video",
          },
          {
            index: 1,
            source: "https://example.com/video.mp4",
            preArgs: [],
            type: "audio",
          },
        ],
        "[0:v][1:a]concat=n=1:v=1:a=1[outv][outa]",
        ["-map", "[outv]", "-map", "[outa]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      await runUntilSettled(runner, sourceFetcher);

      // HTTP video/audio URLs are passed directly to FFmpeg, no sourceFetcher calls
      expect(sourceFetcher).toHaveBeenCalledTimes(0);
    });

    test("handles mix of #references and HTTP URLs", async () => {
      const fetchedSources: string[] = [];
      const sourceFetcher = vi.fn().mockImplementation(async ({ src }) => {
        fetchedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // referenceResolver maps #refs to URLs
      const referenceResolver = (src: string) => {
        if (src === "#__segment_0") return "https://example.com/segment0.mp4";
        return src;
      };

      const command = new FFmpegCommand(
        ["-y"],
        [
          { index: 0, source: "#__segment_0", preArgs: [], type: "image" }, // Use image to ensure fetching
          { index: 1, source: "#__segment_0", preArgs: [], type: "image" }, // Cached
          {
            index: 2,
            source: "https://example.com/music.mp3",
            preArgs: [],
            type: "audio",
          }, // HTTP audio - passed directly to FFmpeg
        ],
        "[0:v][1:v]overlay[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      await runUntilSettled(runner, sourceFetcher, referenceResolver);

      // #__segment_0 once (cached), HTTP audio URL passed directly (no call)
      expect(sourceFetcher).toHaveBeenCalledTimes(1);
      // sourceFetcher receives resolved URL, not #ref
      expect(fetchedSources).toContain("https://example.com/segment0.mp4");
      // HTTP audio URL is passed directly to FFmpeg, not through sourceFetcher
      expect(fetchedSources).not.toContain("https://example.com/music.mp3");
    });

    test("still fetches HTTP image URLs (not passed directly)", async () => {
      const fetchedSources: string[] = [];
      const sourceFetcher = vi.fn().mockImplementation(async ({ src }) => {
        fetchedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // HTTP(S) image URLs should still be fetched (images may need processing)
      const command = new FFmpegCommand(
        ["-y"],
        [
          {
            index: 0,
            source: "https://example.com/image.png",
            preArgs: [],
            type: "image",
          },
          {
            index: 1,
            source: "https://example.com/video.mp4",
            preArgs: [],
            type: "video",
          },
        ],
        "[0:v][1:v]overlay[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      await runUntilSettled(runner, sourceFetcher);

      // Image URL should be fetched, video URL should not
      expect(sourceFetcher).toHaveBeenCalledTimes(1);
      expect(fetchedSources).toContain("https://example.com/image.png");
      expect(fetchedSources).not.toContain("https://example.com/video.mp4");
    });

    test("skips color inputs (no source to fetch)", async () => {
      const fetchedSources: string[] = [];
      const sourceFetcher = vi.fn().mockImplementation(async ({ src }) => {
        fetchedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // referenceResolver maps #refs to URLs
      const referenceResolver = (src: string) => {
        if (src === "#__segment_0") return "https://example.com/segment0.mp4";
        return src;
      };

      const command = new FFmpegCommand(
        ["-y"],
        [
          {
            index: 0,
            source: "",
            preArgs: [
              "-f",
              "lavfi",
              "-i",
              "color=black:size=1920x1080:rate=30",
            ],
            type: "color",
          },
          { index: 1, source: "#__segment_0", preArgs: [], type: "image" }, // Use image to ensure fetching
        ],
        "[0:v][1:v]overlay[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      await runUntilSettled(runner, sourceFetcher, referenceResolver);

      // Only the #reference should be fetched (as resolved URL), not the color input
      expect(sourceFetcher).toHaveBeenCalledTimes(1);
      expect(sourceFetcher).toHaveBeenCalledWith({
        type: "image",
        src: "https://example.com/segment0.mp4",
      });
    });
  });

  describe("failure handling", () => {
    test("removes the temp dir when an input fetch fails", async () => {
      const mkdtempSpy = vi.spyOn(fsp, "mkdtemp");
      try {
        const sourceFetcher = vi
          .fn()
          .mockRejectedValue(new Error("fetch failed"));

        const command = new FFmpegCommand(
          ["-y"],
          [
            {
              index: 0,
              source: "https://example.com/image.png",
              preArgs: [],
              type: "image",
            },
          ],
          "[0:v]copy[outv]",
          ["-map", "[outv]", "-f", "null", "-"],
        );

        const runner = new FFmpegRunner(command);

        await expect(runner.run(sourceFetcher)).rejects.toThrow("fetch failed");

        // The ffs-* temp dir created for this run must not be left behind:
        // the fetch failed before ffmpeg spawned, so the process `close`
        // handler (which owns happy-path cleanup) never runs.
        expect(mkdtempSpy).toHaveBeenCalledTimes(1);
        const tempDir = await mkdtempSpy.mock.results[0].value;
        await expect(fsp.access(tempDir)).rejects.toThrow();
      } finally {
        mkdtempSpy.mockRestore();
      }
    });

    test(
      "rejects when an animation archive is truncated",
      { timeout: 5000 },
      async () => {
        // A minimal annie (TAR of frames), cut off after the header of its
        // second frame (each frame takes a 512-byte header and 1024 bytes of
        // padded data).
        const pack = tar.pack();
        pack.entry({ name: "frame_00001" }, Buffer.alloc(600, 1));
        pack.entry({ name: "frame_00002" }, Buffer.alloc(600, 2));
        pack.finalize();
        const chunks: Buffer[] = [];
        for await (const chunk of pack) chunks.push(chunk as Buffer);
        const truncated = Buffer.concat(chunks).subarray(0, 2048);

        const sourceFetcher = vi
          .fn()
          .mockImplementation(async () => Readable.from([truncated]));

        const command = new FFmpegCommand(
          ["-y"],
          [
            {
              index: 0,
              source: "https://example.com/animation.annie",
              preArgs: [],
              type: "animation",
            },
          ],
          "[0:v]copy[outv]",
          ["-map", "[outv]", "-f", "null", "-"],
        );

        const runner = new FFmpegRunner(command);

        // Must reject (not hang) when the archive ends partway through.
        await expect(runner.run(sourceFetcher)).rejects.toThrow(
          "Unexpected end of annie archive",
        );
      },
    );
  });
});

describe("isSupportedFFmpegVersion", () => {
  test.each([
    "9.0.2",
    "9.0.1",
    "8.1",
    "8.1-static",
    "8.1.1",
    "n8.1.1",
    "10.0",
    "8.10",
  ])("%s is supported", (version) => {
    expect(isSupportedFFmpegVersion(version)).toBe(true);
  });

  test.each([
    "8.0",
    "8.0.1",
    "n8.0",
    "7.1.1",
    "n7.1",
    "6.1.1-3ubuntu5",
    "4.4.2-0ubuntu0.22.04.1",
  ])("%s is too old", (version) => {
    expect(isSupportedFFmpegVersion(version)).toBe(false);
  });

  test.each(["N-120000-gabcdef", "git-2026-01-01-abcdef"])(
    "%s isn't checked",
    (version) => {
      expect(isSupportedFFmpegVersion(version)).toBeUndefined();
    },
  );
});
