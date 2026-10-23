import { describe, test, expect, vi } from "vitest";
import {
  FFmpegCommand,
  FFmpegRunner,
  isSupportedFFmpegVersion,
} from "./ffmpeg";
import type { FFmpegInputInfo } from "./ffmpeg";
import { IMAGE_INFO_BYTES } from "./image-info";
import { annieBuffer } from "@effing/annie";
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
  describe("close", () => {
    const command = () =>
      new FFmpegCommand(
        ["-y"],
        [
          {
            index: 0,
            source: "https://example.com/a.png",
            preArgs: [],
            type: "image",
          },
        ],
        "[0:v]null[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
      );

    test("a closed runner doesn't run", async () => {
      const sourceFetcher = vi.fn();
      const runner = new FFmpegRunner(command());
      runner.close();
      await expect(runner.run(sourceFetcher)).rejects.toThrow(
        "FFmpegRunner is closed",
      );
      expect(sourceFetcher).not.toHaveBeenCalled();
    });

    test("close() while sources are fetched keeps FFmpeg from starting", async () => {
      const runner = new FFmpegRunner(command());
      const sourceFetcher = vi.fn().mockImplementation(async () => {
        runner.close();
        return Readable.from(Buffer.from("test-content"));
      });
      await expect(runner.run(sourceFetcher)).rejects.toThrow(
        "FFmpegRunner is closed",
      );
      expect(sourceFetcher).toHaveBeenCalledOnce();
    });
  });

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

  describe("input info", () => {
    // SOI, then SOF0 (height 20, width 30), then EOI: enough for the header.
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x14, 0x00, 0x1e, 0x03,
      0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
    ]);
    // The same, with 4 components (CMYK), which FFmpeg decodes with alpha.
    const cmyk = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x14, 0x08, 0x00, 0x14, 0x00, 0x1e, 0x04,
      0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0x04, 0x11, 0x00,
      0xff, 0xd9,
    ]);
    // The 3-component one with EXIF orientation 6 (rotate 90° clockwise).
    const rotated = Buffer.concat([
      jpeg.subarray(0, 2),
      Buffer.from([0xff, 0xe1, 0x00, 0x22]),
      Buffer.from("Exif\0\0MM\0\x2a\0\0\0\x08\0\x01", "latin1"),
      Buffer.from([0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]),
      jpeg.subarray(2),
    ]);
    const qoi = (channels: number) =>
      Buffer.from([
        ...Buffer.from("qoif", "latin1"),
        ...[0, 0, 0, 40, 0, 0, 0, 50, channels, 0],
      ]);
    const pngChunk = (type: string, data: Buffer) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      // The CRC isn't checked.
      return Buffer.concat([
        length,
        Buffer.from(type, "latin1"),
        data,
        Buffer.alloc(4),
      ]);
    };
    // A 30x20 RGB PNG with more image data than IMAGE_INFO_BYTES, then an
    // eXIf chunk with orientation 6.
    const bigRotatedPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", Buffer.from([0, 0, 0, 30, 0, 0, 0, 20, 8, 2, 0, 0, 0])),
      pngChunk("IDAT", Buffer.alloc(IMAGE_INFO_BYTES)),
      pngChunk(
        "eXIf",
        Buffer.from([
          ...Buffer.from("MM\0\x2a\0\0\0\x08\0\x01", "latin1"),
          ...[0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0],
        ]),
      ),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
    const annie = (first: Buffer) =>
      annieBuffer(
        (async function* () {
          yield first;
          yield first;
        })(),
      );

    test("the filter graph is built from the fetched sources' headers", async () => {
      const sources: Record<string, () => Promise<Buffer>> = {
        "https://example.com/photo.jpg": async () => jpeg,
        "https://example.com/card.qoi": async () => qoi(4),
        "https://example.com/zoom.tar": () => annie(jpeg),
        "https://example.com/text.tar": () => annie(qoi(3)),
        "https://example.com/unknown": async () => Buffer.from("not an image"),
        "https://example.com/cmyk.jpg": async () => cmyk,
        "https://example.com/rotated.jpg": async () => rotated,
        "https://example.com/cmyk.tar": () => annie(cmyk),
        "https://example.com/rotated.tar": () => annie(rotated),
        "https://example.com/rotated.png": async () => bigRotatedPng,
      };
      const sourceFetcher = vi
        .fn()
        .mockImplementation(async ({ src }) =>
          Readable.from(await sources[src]()),
        );
      const urls = Object.keys(sources);
      let seen: ReadonlyMap<number, FFmpegInputInfo> | undefined;
      const command = new FFmpegCommand(
        ["-y"],
        urls.map((source, index) => ({
          index,
          source,
          preArgs: [],
          type: source.endsWith(".tar") ? "animation" : "image",
        })),
        "[0:v]null[outv]",
        ["-map", "[outv]", "-f", "null", "-"],
        (inputInfo) => {
          seen = inputInfo;
          return "[0:v]null[outv]";
        },
      );
      await runUntilSettled(new FFmpegRunner(command), sourceFetcher);

      expect(seen).toEqual(
        new Map([
          [0, { width: 30, height: 20, opaque: true }],
          [1, { width: 40, height: 50, opaque: false }],
          // An annie's frames are decoded with its first frame's decoder:
          // only JPEG rules out alpha in the frames after the first.
          [2, { width: 30, height: 20, opaque: true }],
          [3, { width: 40, height: 50, opaque: false }],
          [5, { width: 30, height: 20, opaque: false }],
          // FFmpeg shows a JPEG as its EXIF orientation says.
          [6, { width: 20, height: 30, opaque: true }],
          // An annie whose first frame has an alpha plane or is rotated is
          // left alone.
          [7, { width: 30, height: 20, opaque: false }],
          [8, { width: 20, height: 30, opaque: false }],
          // A PNG's EXIF can come after its image data, past the bytes
          // that are enough for a JPEG.
          [9, { width: 20, height: 30, opaque: true }],
        ]),
      );
    });

    test("without a filter graph builder, no source is read", async () => {
      const command = new FFmpegCommand(
        ["-y"],
        [{ index: 0, source: "x", preArgs: [], type: "image" }],
        "[0:v]null[outv]",
        [],
      );
      const resolver = vi.fn();
      expect(await command.readInputInfo(resolver)).toEqual(new Map());
      expect(resolver).not.toHaveBeenCalled();
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
