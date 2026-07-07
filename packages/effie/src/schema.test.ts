import { describe, test, expect } from "vitest";
import {
  effieHttpUrlSchema,
  effieDataUrlSchema,
  effieWebUrlSchema,
  effieFileUrlSchema,
  effieTransitionSchema,
  effieEffectSchema,
  effieMotionSchema,
  effieBackgroundSchema,
  effieAudioSchema,
  effieLayerSchema,
  effieSegmentSchema,
  effieDataSchema,
  effieDataWithFilesSchema,
} from "./schema";

describe("URL schemas", () => {
  describe("effieHttpUrlSchema", () => {
    test("accepts http URLs", () => {
      expect(effieHttpUrlSchema.safeParse("http://example.com").success).toBe(
        true,
      );
    });

    test("accepts https URLs", () => {
      expect(effieHttpUrlSchema.safeParse("https://example.com").success).toBe(
        true,
      );
    });

    test("rejects data URLs", () => {
      expect(
        effieHttpUrlSchema.safeParse("data:image/png;base64,abc").success,
      ).toBe(false);
    });

    test("rejects file URLs", () => {
      expect(effieHttpUrlSchema.safeParse("file:///path/to/file").success).toBe(
        false,
      );
    });

    test("rejects plain strings", () => {
      expect(effieHttpUrlSchema.safeParse("not-a-url").success).toBe(false);
    });
  });

  describe("effieDataUrlSchema", () => {
    test("accepts data URLs", () => {
      expect(
        effieDataUrlSchema.safeParse("data:image/png;base64,abc").success,
      ).toBe(true);
    });

    test("rejects http URLs", () => {
      expect(effieDataUrlSchema.safeParse("https://example.com").success).toBe(
        false,
      );
    });
  });

  describe("effieWebUrlSchema", () => {
    test("accepts http URLs", () => {
      expect(effieWebUrlSchema.safeParse("http://example.com").success).toBe(
        true,
      );
    });

    test("accepts https URLs", () => {
      expect(effieWebUrlSchema.safeParse("https://example.com").success).toBe(
        true,
      );
    });

    test("accepts data URLs", () => {
      expect(
        effieWebUrlSchema.safeParse("data:image/png;base64,abc").success,
      ).toBe(true);
    });

    test("rejects file URLs", () => {
      expect(effieWebUrlSchema.safeParse("file:///path/to/file").success).toBe(
        false,
      );
    });
  });

  describe("effieFileUrlSchema", () => {
    test("accepts file URLs", () => {
      expect(effieFileUrlSchema.safeParse("file:///path/to/file").success).toBe(
        true,
      );
    });

    test("rejects http URLs", () => {
      expect(effieFileUrlSchema.safeParse("https://example.com").success).toBe(
        false,
      );
    });
  });
});

describe("effieTransitionSchema", () => {
  test("accepts fade with easing", () => {
    const result = effieTransitionSchema.safeParse({
      type: "fade",
      duration: 0.5,
      easing: "ease-out",
    });
    expect(result.success).toBe(true);
  });

  test("rejects unknown fields", () => {
    const result = effieTransitionSchema.safeParse({
      type: "wipe",
      duration: 0.5,
      sweep: "left", // wrong field name, should be "direction"
    });
    expect(result.success).toBe(false);
  });

  test("accepts fade through color", () => {
    const result = effieTransitionSchema.safeParse({
      type: "fade",
      duration: 0.5,
      through: "black",
    });
    expect(result.success).toBe(true);
  });

  test("accepts barn transition", () => {
    const result = effieTransitionSchema.safeParse({
      type: "barn",
      duration: 0.5,
      orientation: "horizontal",
      mode: "open",
    });
    expect(result.success).toBe(true);
  });

  test("accepts circle transition", () => {
    const result = effieTransitionSchema.safeParse({
      type: "circle",
      duration: 0.5,
      mode: "crop",
    });
    expect(result.success).toBe(true);
  });

  test("accepts wipe transition", () => {
    const result = effieTransitionSchema.safeParse({
      type: "wipe",
      duration: 0.5,
      direction: "left",
    });
    expect(result.success).toBe(true);
  });

  test("accepts slide transition", () => {
    const result = effieTransitionSchema.safeParse({
      type: "slide",
      duration: 0.5,
      direction: "up",
    });
    expect(result.success).toBe(true);
  });

  test("accepts zoom transition", () => {
    const result = effieTransitionSchema.safeParse({
      type: "zoom",
      duration: 0.5,
    });
    expect(result.success).toBe(true);
  });

  test("accepts dissolve transition", () => {
    const result = effieTransitionSchema.safeParse({
      type: "dissolve",
      duration: 0.5,
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid transition type", () => {
    const result = effieTransitionSchema.safeParse({
      type: "invalid",
      duration: 0.5,
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing duration", () => {
    const result = effieTransitionSchema.safeParse({
      type: "fade",
    });
    expect(result.success).toBe(false);
  });
});

describe("effieEffectSchema", () => {
  test("accepts fade-in effect", () => {
    const result = effieEffectSchema.safeParse({
      type: "fade-in",
      duration: 1,
      start: 0,
    });
    expect(result.success).toBe(true);
  });

  test("accepts fade-out effect", () => {
    const result = effieEffectSchema.safeParse({
      type: "fade-out",
      duration: 1,
      start: 0,
    });
    expect(result.success).toBe(true);
  });

  test("accepts saturate-in effect", () => {
    const result = effieEffectSchema.safeParse({
      type: "saturate-in",
      duration: 1,
      start: 2,
    });
    expect(result.success).toBe(true);
  });

  test("accepts saturate-out effect", () => {
    const result = effieEffectSchema.safeParse({
      type: "saturate-out",
      duration: 1,
      start: 2,
    });
    expect(result.success).toBe(true);
  });

  test("accepts scroll effect", () => {
    const result = effieEffectSchema.safeParse({
      type: "scroll",
      duration: 2,
      direction: "up",
      distance: 100,
    });
    expect(result.success).toBe(true);
  });

  test("rejects fade-in effect missing start", () => {
    const result = effieEffectSchema.safeParse({
      type: "fade-in",
      duration: 1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects scroll effect missing distance", () => {
    const result = effieEffectSchema.safeParse({
      type: "scroll",
      duration: 2,
      direction: "up",
    });
    expect(result.success).toBe(false);
  });
});

describe("effieMotionSchema", () => {
  test("accepts bounce motion", () => {
    const result = effieMotionSchema.safeParse({
      type: "bounce",
      amplitude: 10,
    });
    expect(result.success).toBe(true);
  });

  test("accepts shake motion", () => {
    const result = effieMotionSchema.safeParse({
      type: "shake",
      intensity: 5,
      frequency: 10,
    });
    expect(result.success).toBe(true);
  });

  test("accepts slide motion", () => {
    const result = effieMotionSchema.safeParse({
      type: "slide",
      direction: "right",
      distance: 50,
      easing: "ease-in-out",
    });
    expect(result.success).toBe(true);
  });

  test("rejects slide motion without direction", () => {
    const result = effieMotionSchema.safeParse({
      type: "slide",
      distance: 50,
    });
    expect(result.success).toBe(false);
  });
});

describe("effieBackgroundSchema", () => {
  test("accepts color background", () => {
    const result = effieBackgroundSchema.safeParse({
      type: "color",
      color: "#ff0000",
    });
    expect(result.success).toBe(true);
  });

  test.each([
    "red",
    "#ff0000",
    "#ff000080",
    "0xFF0000",
    "0xFF000080",
    "white@0.5",
    "black@1",
  ])("accepts color background with color %j", (color) => {
    const result = effieBackgroundSchema.safeParse({ type: "color", color });
    expect(result.success).toBe(true);
  });

  test.each([
    "red:size=1x1",
    "color=red[x]",
    "a,b",
    "' quote",
    "has space",
    "red;movie=/etc/passwd",
    "red@2",
    "#ff00",
    "",
  ])("rejects color background with color %j", (color) => {
    const result = effieBackgroundSchema.safeParse({ type: "color", color });
    expect(result.success).toBe(false);
  });

  test("accepts image background with URL", () => {
    const result = effieBackgroundSchema.safeParse({
      type: "image",
      source: "https://example.com/bg.png",
    });
    expect(result.success).toBe(true);
  });

  test("accepts image background with source reference", () => {
    const result = effieBackgroundSchema.safeParse({
      type: "image",
      source: "#myBackground",
    });
    expect(result.success).toBe(true);
  });

  test("accepts video background", () => {
    const result = effieBackgroundSchema.safeParse({
      type: "video",
      source: "https://example.com/bg.mp4",
      seek: 10,
    });
    expect(result.success).toBe(true);
  });

  test("rejects file URL in web schema", () => {
    const result = effieBackgroundSchema.safeParse({
      type: "image",
      source: "file:///path/to/image.png",
    });
    expect(result.success).toBe(false);
  });
});

describe("effieAudioSchema", () => {
  test("accepts audio with all options", () => {
    const result = effieAudioSchema.safeParse({
      source: "https://example.com/audio.mp3",
      volume: 0.8,
      fadeIn: 1,
      fadeOut: 2,
      seek: 5,
    });
    expect(result.success).toBe(true);
  });

  test("accepts audio with source reference", () => {
    const result = effieAudioSchema.safeParse({
      source: "#soundtrack",
    });
    expect(result.success).toBe(true);
  });

  test("rejects volume above 1", () => {
    const result = effieAudioSchema.safeParse({
      source: "https://example.com/audio.mp3",
      volume: 1.5,
    });
    expect(result.success).toBe(false);
  });

  test("rejects volume below 0", () => {
    const result = effieAudioSchema.safeParse({
      source: "https://example.com/audio.mp3",
      volume: -0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("effieLayerSchema", () => {
  test("accepts image layer", () => {
    const result = effieLayerSchema.safeParse({
      type: "image",
      source: "https://example.com/image.png",
    });
    expect(result.success).toBe(true);
  });

  test("accepts animation layer", () => {
    const result = effieLayerSchema.safeParse({
      type: "animation",
      source: "https://example.com/animation.tar",
    });
    expect(result.success).toBe(true);
  });

  test("accepts layer with all options", () => {
    const result = effieLayerSchema.safeParse({
      type: "image",
      source: "#overlay",
      delay: 1,
      from: 0,
      until: 5,
      effects: [{ type: "fade-in", duration: 1, start: 0 }],
      motion: { type: "bounce", amplitude: 5 },
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid layer type", () => {
    const result = effieLayerSchema.safeParse({
      type: "video",
      source: "https://example.com/video.mp4",
    });
    expect(result.success).toBe(false);
  });
});

describe("effieSegmentSchema", () => {
  test("accepts minimal segment", () => {
    const result = effieSegmentSchema.safeParse({
      duration: 5,
      layers: [],
    });
    expect(result.success).toBe(true);
  });

  test("accepts segment with all options", () => {
    const result = effieSegmentSchema.safeParse({
      duration: 5,
      layers: [{ type: "image", source: "https://example.com/image.png" }],
      background: { type: "color", color: "blue" },
      audio: { source: "https://example.com/audio.mp3" },
      transition: { type: "fade", duration: 0.5 },
    });
    expect(result.success).toBe(true);
  });
});

describe("effieDataSchema", () => {
  test("accepts minimal valid data", () => {
    const result = effieDataSchema.safeParse({
      width: 1920,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      segments: [
        {
          duration: 5,
          layers: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("accepts complete effie data", () => {
    const result = effieDataSchema.safeParse({
      width: 1080,
      height: 1920,
      fps: 30,
      cover: "https://example.com/cover.png",
      sources: {
        intro: "https://example.com/intro.tar",
        outro: "https://example.com/outro.tar",
        music: "https://example.com/music.mp3",
      },
      background: { type: "color", color: "#000000" },
      audio: { source: "#music", volume: 0.5, fadeOut: 2 },
      segments: [
        {
          duration: 5,
          layers: [{ type: "animation", source: "#intro" }],
        },
        {
          duration: 3,
          layers: [{ type: "animation", source: "#outro" }],
          transition: { type: "fade", duration: 0.5 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing required fields", () => {
    const result = effieDataSchema.safeParse({
      width: 1920,
      height: 1080,
      // missing fps, cover, background, segments
    });
    expect(result.success).toBe(false);
  });

  test("rejects file URL in sources", () => {
    const result = effieDataSchema.safeParse({
      width: 1920,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      sources: {
        local: "file:///path/to/file.png",
      },
      segments: [{ duration: 5, layers: [] }],
    });
    expect(result.success).toBe(false);
  });

  describe("source reference validation", () => {
    test("rejects undefined source reference in layer", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#nonexistent" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'Source reference "#nonexistent" not found in sources',
      );
    });

    test("rejects undefined source reference in audio", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        audio: { source: "#missing" },
        segments: [{ duration: 5, layers: [] }],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'Source reference "#missing" not found in sources',
      );
    });

    test("rejects undefined source reference in background", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "image", source: "#undefined" },
        segments: [{ duration: 5, layers: [] }],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'Source reference "#undefined" not found in sources',
      );
    });

    test("rejects undefined source reference in segment background", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          {
            duration: 5,
            layers: [],
            background: { type: "video", source: "#missingVideo" },
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'Source reference "#missingVideo" not found in sources',
      );
    });

    test("rejects undefined source reference in segment audio", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          {
            duration: 5,
            layers: [],
            audio: { source: "#missingAudio" },
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        'Source reference "#missingAudio" not found in sources',
      );
    });

    test("reports all undefined source references", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        audio: { source: "#missing1" },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#missing2" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(2);
    });

    test("accepts valid source references", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        sources: {
          bg: "https://example.com/bg.png",
          audio: "https://example.com/audio.mp3",
          layer1: "https://example.com/layer1.png",
        },
        background: { type: "image", source: "#bg" },
        audio: { source: "#audio" },
        segments: [
          {
            duration: 5,
            layers: [{ type: "image", source: "#layer1" }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("transition duration validation", () => {
    test("accepts transition when both segments are long enough", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          { duration: 5, layers: [] },
          {
            duration: 5,
            layers: [],
            transition: { type: "fade", duration: 1 },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    test("accepts transition when segments equal transition duration", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          { duration: 2, layers: [] },
          {
            duration: 2,
            layers: [],
            transition: { type: "fade", duration: 2 },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    test("rejects transition longer than current segment", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          { duration: 5, layers: [] },
          {
            duration: 1,
            layers: [],
            transition: { type: "fade", duration: 2 },
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("Segment 1 duration");
      expect(result.error?.issues[0].path).toEqual(["segments", 1, "duration"]);
    });

    test("rejects transition longer than previous segment", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          { duration: 1, layers: [] },
          {
            duration: 5,
            layers: [],
            transition: { type: "fade", duration: 2 },
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("Segment 0 duration");
      expect(result.error?.issues[0].path).toEqual(["segments", 0, "duration"]);
    });

    test("reports both errors when both segments are too short", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          { duration: 1, layers: [] },
          {
            duration: 1,
            layers: [],
            transition: { type: "fade", duration: 2 },
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(2);
    });

    test("validates multiple transitions independently", () => {
      const result = effieDataSchema.safeParse({
        width: 1920,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "black" },
        segments: [
          { duration: 5, layers: [] },
          {
            duration: 2,
            layers: [],
            transition: { type: "fade", duration: 1 },
          },
          {
            duration: 1,
            layers: [],
            transition: { type: "wipe", duration: 3 },
          },
        ],
      });
      expect(result.success).toBe(false);
      // Segment 1 (duration 2) is too short for segment 2's 3s transition
      // Segment 2 (duration 1) is too short for its own 3s transition
      expect(result.error?.issues).toHaveLength(2);
    });
  });
});

describe("effieDataWithFilesSchema", () => {
  test("accepts file URLs", () => {
    const result = effieDataWithFilesSchema.safeParse({
      width: 1920,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png", // cover must still be web URL
      background: { type: "image", source: "file:///path/to/bg.png" },
      segments: [
        {
          duration: 5,
          layers: [{ type: "image", source: "file:///path/to/layer.png" }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("accepts mixed web and file URLs", () => {
    const result = effieDataWithFilesSchema.safeParse({
      width: 1920,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      sources: {
        webAsset: "https://example.com/asset.png",
        localAsset: "file:///path/to/local.png",
      },
      segments: [{ duration: 5, layers: [] }],
    });
    expect(result.success).toBe(true);
  });
});
