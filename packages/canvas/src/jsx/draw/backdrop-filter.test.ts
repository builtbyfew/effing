import { describe, expect, it } from "vitest";

import { filterBleed, scaleFilterLengths } from "./backdrop-filter.ts";

describe("filterBleed", () => {
  it("is zero for filters that don't sample neighbours", () => {
    expect(filterBleed("brightness(0.5) saturate(2)")).toBe(0);
  });

  it("is three sigmas per blur", () => {
    expect(filterBleed("blur(10px)")).toBe(30);
    expect(filterBleed("blur(4px) saturate(1.5) blur(2px)")).toBe(18);
  });

  it("accounts for drop-shadow offsets and blur", () => {
    expect(filterBleed("drop-shadow(4px -6px 2px red)")).toBe(16);
    expect(filterBleed("drop-shadow(3px 3px black)")).toBe(6);
  });
});

describe("scaleFilterLengths", () => {
  it("multiplies px lengths by the scale", () => {
    expect(scaleFilterLengths("blur(10px)", 2)).toBe("blur(20px)");
    expect(scaleFilterLengths("drop-shadow(2px -4px 1.5px red)", 0.5)).toBe(
      "drop-shadow(1px -2px 0.75px red)",
    );
  });

  it("leaves unitless values alone", () => {
    expect(scaleFilterLengths("brightness(0.5)", 3)).toBe("brightness(0.5)");
  });

  it("never writes exponent notation, which Skia rejects", () => {
    expect(scaleFilterLengths("blur(0.0001px)", 0.001)).toBe("blur(0px)");
    expect(scaleFilterLengths("blur(3px)", 1 / 3)).toBe("blur(1px)");
  });
});
