import { describe, expect, test } from "vitest";
import { parseEffieData } from "./shared";

const FILE_URL = "file:///tmp/photo.png";

function effie(overrides: Record<string, unknown> = {}) {
  return {
    width: 160,
    height: 120,
    fps: 30,
    cover: "https://example.com/cover.png",
    background: { type: "color", color: "black" },
    segments: [
      {
        duration: 1,
        layers: [{ type: "image", source: FILE_URL }],
      },
    ],
    ...overrides,
  };
}

describe("parseEffieData", () => {
  test("rejects file: sources by default", () => {
    const result = parseEffieData(effie(), false);
    expect(result).toMatchObject({
      error: "Invalid effie data",
      issues: [{ path: "segments.0.layers.0.source" }],
    });
  });

  test("accepts file: sources when local files are allowed", () => {
    const body = effie({
      sources: { bg: FILE_URL },
      background: { type: "image", source: "#bg" },
      audio: { source: "file:///tmp/music.mp3" },
    });
    const result = parseEffieData(body, false, true);
    expect(result).toEqual({ effie: body });
  });

  test("accepts the wrapped format when local files are allowed", () => {
    const body = effie();
    expect(parseEffieData({ effie: body }, false, true)).toEqual({
      effie: body,
    });
  });

  test("keeps the cover web-only when local files are allowed", () => {
    const result = parseEffieData(effie({ cover: FILE_URL }), false, true);
    expect(result).toMatchObject({
      error: "Invalid effie data",
      issues: [{ path: "cover" }],
    });
  });

  test("keeps validating everything else when local files are allowed", () => {
    // The renderer interpolates the color into a lavfi filtergraph and
    // relies on the schema to keep filtergraph metacharacters out.
    const result = parseEffieData(
      effie({ background: { type: "color", color: "black:size=1x1" } }),
      false,
      true,
    );
    expect(result).toMatchObject({
      error: "Invalid effie data",
      issues: [{ path: "background.color" }],
    });
  });

  test("skipValidation still bypasses the schema", () => {
    const body = effie({ cover: FILE_URL });
    expect(parseEffieData(body, true)).toEqual({ effie: body });
    expect(parseEffieData(body, true, true)).toEqual({ effie: body });
  });
});
