import { describe, test, expect, vi } from "vitest";
import { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
import { Readable } from "stream";

describe("FFmpegRunner", () => {
  describe("source caching", () => {
    test("caches #reference sources to avoid duplicate fetches", async () => {
      const resolvedSources: string[] = [];
      const sourceResolver = vi.fn().mockImplementation(async ({ src }) => {
        resolvedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // Simulate what effieDataForJoin produces: same #reference for background and audio
      const command = new FFmpegCommand(
        ["-y"],
        [
          { index: 0, source: "#__segment_0", preArgs: [], type: "video" },
          { index: 1, source: "#__segment_0", preArgs: [], type: "audio" }, // Same source!
          { index: 2, source: "#__segment_1", preArgs: [], type: "video" },
          { index: 3, source: "#__segment_1", preArgs: [], type: "audio" }, // Same source!
        ],
        "[0:v][1:a]concat=n=1:v=1:a=1[outv][outa]",
        ["-map", "[outv]", "-map", "[outa]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      // The run will fail when FFmpeg tries to spawn, but source resolution happens first
      try {
        await runner.run(sourceResolver);
      } catch {
        // Expected - FFmpeg process will fail, but we've already tested the caching
      } finally {
        runner.close();
      }

      // Should only be called twice (once per unique #reference), not 4 times
      expect(sourceResolver).toHaveBeenCalledTimes(2);
      expect(resolvedSources).toContain("#__segment_0");
      expect(resolvedSources).toContain("#__segment_1");
    });

    test("does not cache non-reference sources", async () => {
      const resolvedSources: string[] = [];
      const sourceResolver = vi.fn().mockImplementation(async ({ src }) => {
        resolvedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      // Direct URLs (not #references) should not be cached
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
          }, // Same URL, but not cached
        ],
        "[0:v][1:a]concat=n=1:v=1:a=1[outv][outa]",
        ["-map", "[outv]", "-map", "[outa]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      try {
        await runner.run(sourceResolver);
      } catch {
        // Expected
      } finally {
        runner.close();
      }

      // Both calls should happen since URLs are not cached
      expect(sourceResolver).toHaveBeenCalledTimes(2);
    });

    test("handles mix of cached and non-cached sources", async () => {
      const resolvedSources: string[] = [];
      const sourceResolver = vi.fn().mockImplementation(async ({ src }) => {
        resolvedSources.push(src);
        return Readable.from(Buffer.from("test-content"));
      });

      const command = new FFmpegCommand(
        ["-y"],
        [
          { index: 0, source: "#__segment_0", preArgs: [], type: "video" },
          { index: 1, source: "#__segment_0", preArgs: [], type: "audio" }, // Cached
          {
            index: 2,
            source: "https://example.com/music.mp3",
            preArgs: [],
            type: "audio",
          }, // Not cached
        ],
        "[0:v][1:a][2:a]amix=inputs=2[outa]",
        ["-map", "[0:v]", "-map", "[outa]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      try {
        await runner.run(sourceResolver);
      } catch {
        // Expected
      } finally {
        runner.close();
      }

      // #__segment_0 once (cached) + https URL once = 2 calls
      expect(sourceResolver).toHaveBeenCalledTimes(2);
      expect(resolvedSources).toContain("#__segment_0");
      expect(resolvedSources).toContain("https://example.com/music.mp3");
    });

    test("skips color inputs (no source to fetch)", async () => {
      const sourceResolver = vi.fn().mockImplementation(async () => {
        return Readable.from(Buffer.from("test-content"));
      });

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
          { index: 1, source: "#__segment_0", preArgs: [], type: "video" },
        ],
        "[0:v][1:v]overlay[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
      );

      const runner = new FFmpegRunner(command);

      try {
        await runner.run(sourceResolver);
      } catch {
        // Expected
      } finally {
        runner.close();
      }

      // Only the #reference should be resolved, not the color input
      expect(sourceResolver).toHaveBeenCalledTimes(1);
      expect(sourceResolver).toHaveBeenCalledWith({
        type: "video",
        src: "#__segment_0",
      });
    });
  });
});
