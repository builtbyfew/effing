import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  _resetFontMetricsForTest,
  fontGeneration,
  fontLineGap,
  registerFontMetrics,
} from "./font-metrics.ts";
import { normalLineBox } from "./text/native.ts";

const FONTS = join(import.meta.dirname, "../../comparison/_helpers/fonts");
const font = (file: string) => readFileSync(join(FONTS, file));

// Liberation Sans: hhea ascender 1854, descender -434, line gap 67, 2048 to
// the em. Noto Sans Thai: 1061, -450 and 0, 1000 to the em.
const LIBERATION = { ascent: 1854 / 2048, descent: 434 / 2048 };
const NOTO_THAI = { ascent: 1.061, descent: 0.45 };

describe("fontLineGap", () => {
  beforeEach(() => _resetFontMetricsForTest());

  it("reads the hhea line gap of a WOFF font", () => {
    registerFontMetrics("Liberation Sans", font("LiberationSans-Regular.woff"));
    expect(
      fontLineGap(
        '"Liberation Sans", sans-serif',
        20,
        LIBERATION.ascent * 20,
        LIBERATION.descent * 20,
      ),
    ).toBeCloseTo((67 / 2048) * 20, 6);
  });

  it("finds the font by the ascent and descent the paragraph found", () => {
    registerFontMetrics("Liberation Sans", font("LiberationSans-Regular.woff"));
    registerFontMetrics("Noto Sans Thai", font("NotoSansThai-Regular.woff"));
    const at16 = (m: typeof LIBERATION) =>
      fontLineGap(
        "Liberation Sans, Noto Sans Thai",
        16,
        m.ascent * 16,
        m.descent * 16,
      );
    expect(at16(LIBERATION)).toBeCloseTo((67 / 2048) * 16, 6);
    expect(at16(NOTO_THAI)).toBe(0);
    // A font registered under another name, or without one, is found too.
    expect(
      fontLineGap("Arial", 16, LIBERATION.ascent * 16, LIBERATION.descent * 16),
    ).toBeCloseTo((67 / 2048) * 16, 6);
  });

  it("counts no line gap for a font it doesn't know", () => {
    registerFontMetrics("Broken", new Uint8Array([1, 2, 3, 4, 5]));
    expect(fontLineGap("Broken", 20, 18, 4)).toBe(0);
  });

  it("starts a new generation with every font", () => {
    const before = fontGeneration();
    registerFontMetrics("Liberation Sans", font("LiberationSans-Regular.woff"));
    expect(fontGeneration()).toBeGreaterThan(before);
  });
});

describe("normalLineBox", () => {
  it("rounds the ascent, descent and line gap each, as Chrome does", () => {
    // Liberation Sans at 20px: 18.1, 4.24 and 0.65.
    expect(normalLineBox(18.105, 4.238, 0.654)).toEqual({
      lineHeight: 23,
      baseline: 18,
      ascent: 18,
      descent: 4,
    });
    // At 48px: 43.45, 10.17 and 1.57; the gap is split over the line's top
    // and bottom.
    expect(normalLineBox(43.453, 10.172, 1.57)).toMatchObject({
      lineHeight: 55,
      baseline: 44,
    });
    // Halves round up: Inter's ascent at 16px is 15.5.
    expect(normalLineBox(15.5, 3.859, 0)).toMatchObject({
      lineHeight: 20,
      baseline: 16,
    });
    // A negative line gap counts as none.
    expect(normalLineBox(10, 3, -2).lineHeight).toBe(13);
  });
});
