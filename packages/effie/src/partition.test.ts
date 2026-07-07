import { describe, test, expect } from "vitest";
import { effieDataForSegment, effieDataForJoin } from "./partition";
import type { EffieData, EffieSources, EffieWebUrl } from "./types";

// Helper to create minimal valid EffieData
function createBaseEffieData(
  overrides: Partial<EffieData<EffieSources>> = {},
): EffieData<EffieSources> {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    cover: "https://example.com/cover.png",
    background: { type: "color", color: "black" },
    segments: [
      {
        duration: 5,
        layers: [{ type: "image", source: "https://example.com/layer1.png" }],
      },
    ],
    ...overrides,
  };
}

describe("effieDataForSegment", () => {
  describe("segment index validation", () => {
    test("throws for negative segment index", () => {
      const effieData = createBaseEffieData();
      expect(() => effieDataForSegment(effieData, -1)).toThrowError(
        "Invalid segment index: -1. Must be between 0 and 0",
      );
    });

    test("throws for segment index beyond array length", () => {
      const effieData = createBaseEffieData();
      expect(() => effieDataForSegment(effieData, 1)).toThrowError(
        "Invalid segment index: 1. Must be between 0 and 0",
      );
    });

    test("throws for segment index equal to array length", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });
      expect(() => effieDataForSegment(effieData, 2)).toThrowError(
        "Invalid segment index: 2. Must be between 0 and 1",
      );
    });

    test("accepts valid segment index 0", () => {
      const effieData = createBaseEffieData();
      expect(() => effieDataForSegment(effieData, 0)).not.toThrow();
    });

    test("accepts valid segment index for multi-segment effie", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
          { duration: 4, layers: [] },
        ],
      });
      expect(() => effieDataForSegment(effieData, 2)).not.toThrow();
    });
  });

  describe("basic structure", () => {
    test("preserves width, height, fps, and cover", () => {
      const effieData = createBaseEffieData({
        width: 1280,
        height: 720,
        fps: 60,
        cover: "https://example.com/custom-cover.png",
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      expect(result.fps).toBe(60);
      expect(result.cover).toBe("https://example.com/custom-cover.png");
    });

    test("includes only the target segment", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
          { duration: 4, layers: [] },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].duration).toBe(3);
    });

    test("excludes global audio", () => {
      const effieData = createBaseEffieData({
        audio: {
          source: "https://example.com/music.mp3",
          volume: 0.5,
        },
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.audio).toBeUndefined();
    });
  });

  describe("background handling", () => {
    test("passes color background as-is", () => {
      const effieData = createBaseEffieData({
        background: { type: "color", color: "#FF5500" },
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.background).toEqual({ type: "color", color: "#FF5500" });
    });

    test("passes image background as-is", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "image",
          source: "https://example.com/bg.png",
        },
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.background).toEqual({
        type: "image",
        source: "https://example.com/bg.png",
      });
    });

    test("accumulates seek time for video background - first segment", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
          seek: 10,
        },
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 10, // original seek + 0 (no prior segments)
      });
    });

    test("accumulates seek time for video background - second segment", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
          seek: 10,
        },
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 15, // 10 + 5 (duration of segment 0)
      });
    });

    test("accumulates seek time for video background - third segment", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
          seek: 5,
        },
        segments: [
          { duration: 10, layers: [] },
          { duration: 8, layers: [] },
          { duration: 6, layers: [] },
        ],
      });

      const result = effieDataForSegment(effieData, 2);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 23, // 5 + 10 + 8
      });
    });

    test("subtracts transition overlap from accumulated seek", () => {
      // A transition overlaps the tail of the previous segment, so the
      // monolithic renderer advances the shared background by
      // duration - transitionDuration per segment. The partitioned seek
      // must match, or the background jumps at segment boundaries.
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
          seek: 10,
        },
        segments: [
          { duration: 5, layers: [] },
          {
            duration: 3,
            layers: [],
            transition: { type: "fade", duration: 0.5 },
          },
          { duration: 4, layers: [] },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 14.5, // 10 + (5 - 0.5 transition overlap)
      });
    });

    test("accumulates transition-adjusted seek across multiple segments", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
          seek: 10,
        },
        segments: [
          { duration: 5, layers: [] },
          {
            duration: 3,
            layers: [],
            transition: { type: "fade", duration: 0.5 },
          },
          {
            duration: 4,
            layers: [],
            transition: { type: "wipe", duration: 1, direction: "left" },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 2);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 16.5, // 10 + (5 - 0.5) + (3 - 1)
      });
    });

    test("ignores the target segment's own outgoing transition", () => {
      // Only transitions *into* prior boundaries shorten the timeline; a
      // transition on the segment after the target does not affect its seek.
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
        },
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
          {
            duration: 4,
            layers: [],
            transition: { type: "fade", duration: 0.5 },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 5, // 0 + 5; segment 2's transition is irrelevant here
      });
    });

    test("floors each prior segment's contribution at 0.001", () => {
      // Mirrors the renderer's Math.max(0.001, ...) guard so both paths
      // compute the same timestamp even in degenerate cases.
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
        },
        segments: [
          { duration: 1, layers: [] },
          {
            duration: 3,
            layers: [],
            transition: { type: "fade", duration: 1 },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 0.001,
      });
    });

    test("defaults seek to 0 for video background without seek", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
        },
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.background).toEqual({
        type: "video",
        source: "https://example.com/bg.mp4",
        seek: 5, // 0 + 5
      });
    });
  });

  describe("source references", () => {
    test("includes background source reference", () => {
      const effieData = createBaseEffieData({
        sources: {
          bgImage: "https://example.com/bg.png",
          unused: "https://example.com/unused.png",
        },
        background: { type: "image", source: "#bgImage" },
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toEqual({
        bgImage: "https://example.com/bg.png",
      });
    });

    test("includes layer source references", () => {
      const effieData = createBaseEffieData({
        sources: {
          layer1: "https://example.com/l1.png",
          layer2: "https://example.com/l2.png",
          unused: "https://example.com/unused.png",
        },
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "#layer1" },
              { type: "image", source: "#layer2" },
            ],
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toEqual({
        layer1: "https://example.com/l1.png",
        layer2: "https://example.com/l2.png",
      });
    });

    test("includes segment audio source reference", () => {
      const effieData = createBaseEffieData({
        sources: {
          segAudio: "https://example.com/audio.mp3",
          unused: "https://example.com/unused.png",
        },
        segments: [
          {
            duration: 5,
            layers: [],
            audio: { source: "#segAudio", volume: 0.8 },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toEqual({
        segAudio: "https://example.com/audio.mp3",
      });
    });

    test("collects only sources used by the specific segment", () => {
      const effieData = createBaseEffieData({
        sources: {
          seg0Layer: "https://example.com/seg0.png",
          seg1Layer: "https://example.com/seg1.png",
          seg2Layer: "https://example.com/seg2.png",
        },
        segments: [
          { duration: 5, layers: [{ type: "image", source: "#seg0Layer" }] },
          { duration: 3, layers: [{ type: "image", source: "#seg1Layer" }] },
          { duration: 4, layers: [{ type: "image", source: "#seg2Layer" }] },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.sources).toEqual({
        seg1Layer: "https://example.com/seg1.png",
      });
    });

    test("omits sources property when no source references are used", () => {
      const effieData = createBaseEffieData({
        sources: {
          unused: "https://example.com/unused.png",
        },
        background: { type: "color", color: "black" },
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "https://example.com/direct.png" },
            ],
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toBeUndefined();
    });

    test("handles direct URLs (non-references) correctly", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "image",
          source: "https://example.com/direct-bg.png",
        },
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "https://example.com/direct-layer.png" },
            ],
            audio: { source: "https://example.com/direct-audio.mp3" },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toBeUndefined();
      expect(result.background).toEqual({
        type: "image",
        source: "https://example.com/direct-bg.png",
      });
    });
  });

  describe("segment data preservation", () => {
    test("preserves all segment properties", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 7,
            layers: [
              {
                type: "image",
                source: "https://example.com/layer.png",
                delay: 1,
                from: 0.5,
                until: 6,
                effects: [{ type: "fade-in", start: 0, duration: 1 }],
                motion: { type: "bounce", amplitude: 10 },
              },
            ],
            audio: {
              source: "https://example.com/audio.mp3",
              volume: 0.7,
              fadeIn: 0.5,
              fadeOut: 0.5,
            },
            transition: { type: "fade", duration: 0.5 },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.segments[0]).toEqual(effieData.segments[0]);
    });
  });

  describe("segment background handling", () => {
    test("preserves segment with color background", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [],
            background: { type: "color", color: "#FF0000" },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.segments[0].background).toEqual({
        type: "color",
        color: "#FF0000",
      });
    });

    test("preserves segment with image background", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [],
            background: {
              type: "image",
              source: "https://example.com/segment-bg.png",
            },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.segments[0].background).toEqual({
        type: "image",
        source: "https://example.com/segment-bg.png",
      });
    });

    test("preserves segment with video background", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [],
            background: {
              type: "video",
              source: "https://example.com/segment-bg.mp4",
              seek: 10,
            },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.segments[0].background).toEqual({
        type: "video",
        source: "https://example.com/segment-bg.mp4",
        seek: 10,
      });
    });

    test("includes segment background source reference", () => {
      const effieData = createBaseEffieData({
        sources: {
          segBg: "https://example.com/segment-bg.mp4",
          unused: "https://example.com/unused.png",
        },
        segments: [
          {
            duration: 5,
            layers: [],
            background: { type: "video", source: "#segBg" },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toEqual({
        segBg: "https://example.com/segment-bg.mp4",
      });
    });

    test("collects both global and segment background source references", () => {
      const effieData = createBaseEffieData({
        sources: {
          globalBg: "https://example.com/global-bg.png",
          segBg: "https://example.com/segment-bg.mp4",
          unused: "https://example.com/unused.png",
        },
        background: { type: "image", source: "#globalBg" },
        segments: [
          {
            duration: 5,
            layers: [],
            background: { type: "video", source: "#segBg" },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.sources).toEqual({
        globalBg: "https://example.com/global-bg.png",
        segBg: "https://example.com/segment-bg.mp4",
      });
    });

    test("handles segment without background (undefined)", () => {
      const effieData = createBaseEffieData({
        segments: [{ duration: 5, layers: [] }],
      });

      const result = effieDataForSegment(effieData, 0);

      expect(result.segments[0].background).toBeUndefined();
    });

    test("only collects segment background source for specific segment", () => {
      const effieData = createBaseEffieData({
        sources: {
          seg0Bg: "https://example.com/seg0-bg.mp4",
          seg1Bg: "https://example.com/seg1-bg.mp4",
        },
        segments: [
          {
            duration: 5,
            layers: [],
            background: { type: "video", source: "#seg0Bg" },
          },
          {
            duration: 3,
            layers: [],
            background: { type: "video", source: "#seg1Bg" },
          },
        ],
      });

      const result = effieDataForSegment(effieData, 1);

      expect(result.sources).toEqual({
        seg1Bg: "https://example.com/seg1-bg.mp4",
      });
    });
  });
});

describe("effieDataForJoin", () => {
  describe("segment sources validation", () => {
    test("throws when segment sources count doesn't match segment count", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      expect(() => effieDataForJoin(effieData, segmentSources)).toThrowError(
        "Expected 2 segment sources, got 1",
      );
    });

    test("throws when too many segment sources provided", () => {
      const effieData = createBaseEffieData({
        segments: [{ duration: 5, layers: [] }],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
      ];

      expect(() => effieDataForJoin(effieData, segmentSources)).toThrowError(
        "Expected 1 segment sources, got 2",
      );
    });

    test("accepts matching segment sources count", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
      ];

      expect(() => effieDataForJoin(effieData, segmentSources)).not.toThrow();
    });
  });

  describe("basic structure", () => {
    test("preserves width, height, fps, and cover", () => {
      const effieData = createBaseEffieData({
        width: 1280,
        height: 720,
        fps: 60,
        cover: "https://example.com/custom-cover.png",
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      expect(result.fps).toBe(60);
      expect(result.cover).toBe("https://example.com/custom-cover.png");
    });

    test("sets background to black color", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
        },
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.background).toEqual({ type: "color", color: "black" });
    });
  });

  describe("segment transformation", () => {
    test("preserves segment count", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
          { duration: 4, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
        "https://example.com/seg2.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.segments).toHaveLength(3);
    });

    test("preserves segment durations", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
          { duration: 4, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
        "https://example.com/seg2.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.segments[0].duration).toBe(5);
      expect(result.segments[1].duration).toBe(3);
      expect(result.segments[2].duration).toBe(4);
    });

    test("preserves segment transitions", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          {
            duration: 3,
            layers: [],
            transition: { type: "fade", duration: 0.5 },
          },
          {
            duration: 4,
            layers: [],
            transition: { type: "wipe", duration: 1, direction: "left" },
          },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
        "https://example.com/seg2.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.segments[0].transition).toBeUndefined();
      expect(result.segments[1].transition).toEqual({
        type: "fade",
        duration: 0.5,
      });
      expect(result.segments[2].transition).toEqual({
        type: "wipe",
        duration: 1,
        direction: "left",
      });
    });

    test("sets empty layers array for each segment", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "https://example.com/l1.png" },
              { type: "image", source: "https://example.com/l2.png" },
            ],
          },
          {
            duration: 3,
            layers: [
              { type: "animation", source: "https://example.com/anim.tar" },
            ],
          },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.segments[0].layers).toEqual([]);
      expect(result.segments[1].layers).toEqual([]);
    });

    test("sets segment background to video using #reference", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.segments[0].background).toEqual({
        type: "video",
        source: "#__segment_0",
      });
      expect(result.segments[1].background).toEqual({
        type: "video",
        source: "#__segment_1",
      });
    });

    test("sets segment audio using #reference", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.segments[0].audio).toEqual({
        source: "#__segment_0",
      });
      expect(result.segments[1].audio).toEqual({
        source: "#__segment_1",
      });
    });

    test("adds segment sources to sources object", () => {
      const effieData = createBaseEffieData({
        segments: [
          { duration: 5, layers: [] },
          { duration: 3, layers: [] },
        ],
      });
      const segmentSources: EffieWebUrl[] = [
        "https://example.com/seg0.mp4",
        "https://example.com/seg1.mp4",
      ];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.sources).toMatchObject({
        __segment_0: "https://example.com/seg0.mp4",
        __segment_1: "https://example.com/seg1.mp4",
      });
    });
  });

  describe("global audio handling", () => {
    test("preserves global audio", () => {
      const effieData = createBaseEffieData({
        audio: {
          source: "https://example.com/music.mp3",
          volume: 0.5,
          fadeIn: 1,
          fadeOut: 2,
          seek: 5,
        },
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.audio).toEqual({
        source: "https://example.com/music.mp3",
        volume: 0.5,
        fadeIn: 1,
        fadeOut: 2,
        seek: 5,
      });
    });

    test("handles missing global audio", () => {
      const effieData = createBaseEffieData();
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.audio).toBeUndefined();
    });
  });

  describe("source references", () => {
    test("includes global audio source reference alongside segment sources", () => {
      const effieData = createBaseEffieData({
        sources: {
          music: "https://example.com/music.mp3",
          unused: "https://example.com/unused.png",
        },
        audio: { source: "#music", volume: 0.5 },
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      expect(result.sources).toEqual({
        __segment_0: "https://example.com/seg0.mp4",
        music: "https://example.com/music.mp3",
      });
    });

    test("excludes unused source references from original effieData", () => {
      const effieData = createBaseEffieData({
        sources: {
          layerRef: "https://example.com/layer.png",
        },
        segments: [
          { duration: 5, layers: [{ type: "image", source: "#layerRef" }] },
        ],
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      // Only segment sources are included, not the layerRef (used in original but not in join)
      expect(result.sources).toEqual({
        __segment_0: "https://example.com/seg0.mp4",
      });
    });

    test("handles direct URL for global audio", () => {
      const effieData = createBaseEffieData({
        audio: { source: "https://example.com/direct-music.mp3" },
      });
      const segmentSources: EffieWebUrl[] = ["https://example.com/seg0.mp4"];

      const result = effieDataForJoin(effieData, segmentSources);

      // Segment sources are still included
      expect(result.sources).toEqual({
        __segment_0: "https://example.com/seg0.mp4",
      });
      expect(result.audio?.source).toBe("https://example.com/direct-music.mp3");
    });
  });
});
