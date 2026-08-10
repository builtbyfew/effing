import { describe, expect, it } from "vitest";
import { resolveBounds } from "./bounds";

const RESOLUTIONS = [
  { width: 1080, height: 1080, label: "1:1" },
  { width: 1080, height: 1920, label: "9:16" },
];

describe("resolveBounds", () => {
  it("defaults to the first preset", () => {
    expect(resolveBounds(RESOLUTIONS, {})).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  it("falls back to the built-in presets without config", () => {
    expect(resolveBounds(undefined, {})).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  it("lets explicit dimensions override the fallback piecewise", () => {
    expect(resolveBounds(RESOLUTIONS, { height: 1350 })).toEqual({
      width: 1080,
      height: 1350,
    });
  });

  it("picks a preset by label", () => {
    expect(resolveBounds(RESOLUTIONS, { resolution: "9:16" })).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("rejects an unknown label, listing the available ones", () => {
    expect(() => resolveBounds(RESOLUTIONS, { resolution: "4:5" })).toThrow(
      "Unknown resolution '4:5'. Available: 1:1, 9:16.",
    );
  });

  it("rejects combining a label with explicit dimensions", () => {
    expect(() =>
      resolveBounds(RESOLUTIONS, { resolution: "9:16", width: 500 }),
    ).toThrow("--resolution cannot be combined with --width/--height.");
  });

  it.each([NaN, 0, -100, Infinity])(
    "rejects %s as an explicit dimension",
    (value) => {
      expect(() => resolveBounds(RESOLUTIONS, { width: value })).toThrow(
        "--width must be a positive number.",
      );
      expect(() => resolveBounds(RESOLUTIONS, { height: value })).toThrow(
        "--height must be a positive number.",
      );
    },
  );
});
