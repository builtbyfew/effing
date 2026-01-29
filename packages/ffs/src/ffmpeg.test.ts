import { describe, test, expect, vi } from "vitest";
import { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
import { Readable } from "stream";

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
      try {
        await runner.run(sourceFetcher, undefined, referenceResolver);
      } catch {
        // Expected - FFmpeg process will fail, but we've already tested the caching
      } finally {
        runner.close();
      }

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

      try {
        await runner.run(sourceFetcher);
      } catch {
        // Expected - FFmpeg process will fail
      } finally {
        runner.close();
      }

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

      try {
        await runner.run(sourceFetcher, undefined, referenceResolver);
      } catch {
        // Expected
      } finally {
        runner.close();
      }

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

      try {
        await runner.run(sourceFetcher);
      } catch {
        // Expected
      } finally {
        runner.close();
      }

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

      try {
        await runner.run(sourceFetcher, undefined, referenceResolver);
      } catch {
        // Expected
      } finally {
        runner.close();
      }

      // Only the #reference should be fetched (as resolved URL), not the color input
      expect(sourceFetcher).toHaveBeenCalledTimes(1);
      expect(sourceFetcher).toHaveBeenCalledWith({
        type: "image",
        src: "https://example.com/segment0.mp4",
      });
    });
  });
});
