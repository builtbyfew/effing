import { describe, test, expect } from "vitest";
import { extractEffieSources, extractEffieSourcesWithTypes } from "./extract";
import type { EffieData, EffieSources } from "./types";

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

describe("extractEffieSources", () => {
  describe("basic extraction", () => {
    test("extracts cover image", () => {
      const effieData = createBaseEffieData({
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [{ duration: 5, layers: [] }],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/cover.png");
    });

    test("extracts layer sources", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "https://example.com/layer1.png" },
              { type: "animation", source: "https://example.com/anim.tar" },
            ],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/layer1.png");
      expect(sources).toContain("https://example.com/anim.tar");
    });

    test("extracts global background source", () => {
      const effieData = createBaseEffieData({
        background: { type: "image", source: "https://example.com/bg.png" },
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/bg.png");
    });

    test("extracts video background source", () => {
      const effieData = createBaseEffieData({
        background: {
          type: "video",
          source: "https://example.com/bg.mp4",
          seek: 5,
        },
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/bg.mp4");
    });

    test("skips color background", () => {
      const effieData = createBaseEffieData({
        background: { type: "color", color: "#FF0000" },
        segments: [{ duration: 5, layers: [] }],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).not.toContain("#FF0000");
      expect(sources).toHaveLength(1); // Only cover
    });

    test("extracts global audio source", () => {
      const effieData = createBaseEffieData({
        audio: { source: "https://example.com/music.mp3", volume: 0.5 },
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/music.mp3");
    });

    test("extracts segment background source", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [],
            background: {
              type: "image",
              source: "https://example.com/seg-bg.png",
            },
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/seg-bg.png");
    });

    test("extracts segment audio source", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [],
            audio: { source: "https://example.com/seg-audio.mp3" },
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/seg-audio.mp3");
    });
  });

  describe("reference resolution", () => {
    test("resolves #references to actual URLs", () => {
      const effieData = createBaseEffieData({
        sources: {
          myLayer: "https://example.com/resolved-layer.png",
        },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#myLayer" }],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/resolved-layer.png");
      expect(sources).not.toContain("#myLayer");
    });

    test("resolves multiple references", () => {
      const effieData = createBaseEffieData({
        sources: {
          bg: "https://example.com/bg.png",
          layer1: "https://example.com/layer1.png",
          layer2: "https://example.com/layer2.png",
          audio: "https://example.com/audio.mp3",
        },
        background: { type: "image", source: "#bg" },
        audio: { source: "#audio" },
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

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/bg.png");
      expect(sources).toContain("https://example.com/layer1.png");
      expect(sources).toContain("https://example.com/layer2.png");
      expect(sources).toContain("https://example.com/audio.mp3");
    });

    test("skips unresolved references", () => {
      const effieData = createBaseEffieData({
        sources: {},
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#nonexistent" }],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).not.toContain("#nonexistent");
    });
  });

  describe("deduplication", () => {
    test("deduplicates identical URLs", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "https://example.com/same.png" },
              { type: "image", source: "https://example.com/same.png" },
            ],
          },
        ],
      });

      const sources = extractEffieSources(effieData);
      const sameCount = sources.filter(
        (s) => s === "https://example.com/same.png",
      ).length;

      expect(sameCount).toBe(1);
    });

    test("deduplicates resolved references pointing to same URL", () => {
      const effieData = createBaseEffieData({
        sources: {
          ref1: "https://example.com/same.png",
          ref2: "https://example.com/same.png",
        },
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "#ref1" },
              { type: "image", source: "#ref2" },
            ],
          },
        ],
      });

      const sources = extractEffieSources(effieData);
      const sameCount = sources.filter(
        (s) => s === "https://example.com/same.png",
      ).length;

      expect(sameCount).toBe(1);
    });

    test("deduplicates mix of direct URLs and resolved references", () => {
      const effieData = createBaseEffieData({
        sources: {
          myRef: "https://example.com/same.png",
        },
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "#myRef" },
              { type: "image", source: "https://example.com/same.png" },
            ],
          },
        ],
      });

      const sources = extractEffieSources(effieData);
      const sameCount = sources.filter(
        (s) => s === "https://example.com/same.png",
      ).length;

      expect(sameCount).toBe(1);
    });
  });

  describe("data URL handling", () => {
    test("excludes data URLs by default", () => {
      const effieData = createBaseEffieData({
        cover: "data:image/png;base64,iVBORw0KGgo=",
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "data:image/png;base64,ABC123=" },
            ],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toHaveLength(0);
    });

    test("excludes data URLs from resolved references by default", () => {
      const effieData = createBaseEffieData({
        sources: {
          inlineImage: "data:image/png;base64,iVBORw0KGgo=",
        },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#inlineImage" }],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).not.toContain("data:image/png;base64,iVBORw0KGgo=");
    });

    test("includes data URLs when includeDataUrls is true", () => {
      const effieData = createBaseEffieData({
        cover: "data:image/png;base64,iVBORw0KGgo=",
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "data:image/png;base64,ABC123=" },
            ],
          },
        ],
      });

      const sources = extractEffieSources(effieData, { includeDataUrls: true });

      expect(sources).toContain("data:image/png;base64,iVBORw0KGgo=");
      expect(sources).toContain("data:image/png;base64,ABC123=");
    });

    test("includes resolved data URLs when includeDataUrls is true", () => {
      const effieData = createBaseEffieData({
        sources: {
          inlineImage: "data:image/png;base64,iVBORw0KGgo=",
        },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#inlineImage" }],
          },
        ],
      });

      const sources = extractEffieSources(effieData, { includeDataUrls: true });

      expect(sources).toContain("data:image/png;base64,iVBORw0KGgo=");
    });
  });

  describe("multiple segments", () => {
    test("extracts sources from all segments", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "https://example.com/seg0.png" }],
          },
          {
            duration: 3,
            layers: [{ type: "image", source: "https://example.com/seg1.png" }],
          },
          {
            duration: 4,
            layers: [{ type: "image", source: "https://example.com/seg2.png" }],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/seg0.png");
      expect(sources).toContain("https://example.com/seg1.png");
      expect(sources).toContain("https://example.com/seg2.png");
    });

    test("extracts segment backgrounds and audio from all segments", () => {
      const effieData = createBaseEffieData({
        segments: [
          {
            duration: 5,
            layers: [],
            background: {
              type: "image",
              source: "https://example.com/seg0-bg.png",
            },
            audio: { source: "https://example.com/seg0-audio.mp3" },
          },
          {
            duration: 3,
            layers: [],
            background: {
              type: "video",
              source: "https://example.com/seg1-bg.mp4",
            },
            audio: { source: "https://example.com/seg1-audio.mp3" },
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/seg0-bg.png");
      expect(sources).toContain("https://example.com/seg0-audio.mp3");
      expect(sources).toContain("https://example.com/seg1-bg.mp4");
      expect(sources).toContain("https://example.com/seg1-audio.mp3");
    });
  });

  describe("comprehensive extraction", () => {
    test("extracts all source types from complex effie data", () => {
      const effieData = createBaseEffieData({
        cover: "https://example.com/cover.png",
        sources: {
          bgRef: "https://example.com/bg-ref.png",
          layerRef: "https://example.com/layer-ref.png",
          audioRef: "https://example.com/audio-ref.mp3",
        },
        background: { type: "image", source: "#bgRef" },
        audio: { source: "#audioRef", volume: 0.5 },
        segments: [
          {
            duration: 5,
            layers: [
              { type: "image", source: "#layerRef" },
              { type: "image", source: "https://example.com/direct-layer.png" },
            ],
            background: {
              type: "video",
              source: "https://example.com/seg-bg.mp4",
            },
            audio: { source: "https://example.com/seg-audio.mp3" },
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toContain("https://example.com/cover.png");
      expect(sources).toContain("https://example.com/bg-ref.png");
      expect(sources).toContain("https://example.com/layer-ref.png");
      expect(sources).toContain("https://example.com/audio-ref.mp3");
      expect(sources).toContain("https://example.com/direct-layer.png");
      expect(sources).toContain("https://example.com/seg-bg.mp4");
      expect(sources).toContain("https://example.com/seg-audio.mp3");
    });

    test("returns empty array when no fetchable sources exist", () => {
      const effieData = createBaseEffieData({
        cover: "data:image/png;base64,cover=",
        background: { type: "color", color: "black" },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "data:image/png;base64,layer=" }],
          },
        ],
      });

      const sources = extractEffieSources(effieData);

      expect(sources).toHaveLength(0);
    });
  });
});

describe("extractEffieSourcesWithTypes", () => {
  test("extracts sources with correct types", () => {
    const effieData = createBaseEffieData({
      cover: "https://example.com/cover.png",
      background: { type: "video", source: "https://example.com/bg.mp4" },
      audio: { source: "https://example.com/music.mp3" },
      segments: [
        {
          duration: 5,
          layers: [
            { type: "image", source: "https://example.com/layer.png" },
            { type: "animation", source: "https://example.com/anim.tar" },
          ],
          audio: { source: "https://example.com/seg-audio.mp3" },
        },
      ],
    });

    const sources = extractEffieSourcesWithTypes(effieData);

    expect(sources).toContainEqual({
      url: "https://example.com/cover.png",
      type: "image",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/bg.mp4",
      type: "video",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/music.mp3",
      type: "audio",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/layer.png",
      type: "image",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/anim.tar",
      type: "animation",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/seg-audio.mp3",
      type: "audio",
    });
  });

  test("resolves #references with correct types", () => {
    const effieData = createBaseEffieData({
      sources: {
        bgVideo: "https://example.com/bg.mp4",
        music: "https://example.com/music.mp3",
      },
      background: { type: "video", source: "#bgVideo" },
      audio: { source: "#music" },
      segments: [{ duration: 5, layers: [] }],
    });

    const sources = extractEffieSourcesWithTypes(effieData);

    expect(sources).toContainEqual({
      url: "https://example.com/bg.mp4",
      type: "video",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/music.mp3",
      type: "audio",
    });
  });

  test("identifies segment backgrounds by type", () => {
    const effieData = createBaseEffieData({
      segments: [
        {
          duration: 5,
          layers: [],
          background: {
            type: "image",
            source: "https://example.com/seg-bg-image.png",
          },
        },
        {
          duration: 5,
          layers: [],
          background: {
            type: "video",
            source: "https://example.com/seg-bg-video.mp4",
          },
        },
      ],
    });

    const sources = extractEffieSourcesWithTypes(effieData);

    expect(sources).toContainEqual({
      url: "https://example.com/seg-bg-image.png",
      type: "image",
    });
    expect(sources).toContainEqual({
      url: "https://example.com/seg-bg-video.mp4",
      type: "video",
    });
  });

  test("deduplicates with first type winning", () => {
    const effieData = createBaseEffieData({
      // Cover is first, so "image" type should win
      cover: "https://example.com/same.png",
      segments: [
        {
          duration: 5,
          layers: [
            // Same URL used as animation later - should be ignored
            { type: "animation", source: "https://example.com/same.png" },
          ],
        },
      ],
    });

    const sources = extractEffieSourcesWithTypes(effieData);

    const sameUrl = sources.filter(
      (s) => s.url === "https://example.com/same.png",
    );
    expect(sameUrl).toHaveLength(1);
    expect(sameUrl[0].type).toBe("image"); // First type wins
  });

  test("excludes data URLs by default", () => {
    const effieData = createBaseEffieData({
      cover: "data:image/png;base64,ABC=",
      segments: [{ duration: 5, layers: [] }],
    });

    const sources = extractEffieSourcesWithTypes(effieData);

    expect(sources).toHaveLength(0);
  });

  test("includes data URLs when requested", () => {
    const effieData = createBaseEffieData({
      cover: "data:image/png;base64,ABC=",
      segments: [{ duration: 5, layers: [] }],
    });

    const sources = extractEffieSourcesWithTypes(effieData, {
      includeDataUrls: true,
    });

    expect(sources).toContainEqual({
      url: "data:image/png;base64,ABC=",
      type: "image",
    });
  });
});
