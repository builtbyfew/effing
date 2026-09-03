import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import React from "react";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontData } from "../src/types.ts";
import { HAS_NATIVE_DEPS } from "./_helpers/setup.ts";

// ---------------------------------------------------------------------------
// @napi-rs/canvas caches the typefaces Skia picks for each ctx.font
// (family list + weight + style) for the lifetime of the process, and
// registering a font later does not invalidate that cache. These tests pin
// down what that means for @effing/canvas: its own layout and drawing must
// use the right face regardless of registration order, and registerFont must
// warn when a bare ctx.font lookup has already been pinned to the wrong face.
//
// The cache is keyed on the family name, so every scenario registers the
// fixtures under its own alias to start from a clean slate.
// ---------------------------------------------------------------------------

const FONT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "_helpers",
  "fonts",
);
const TEXT = "Andilly (95)";
const W = 600;
const H = 120;

type Api = typeof import("../src/index.ts");
type LayoutText = (typeof import("../src/jsx/text/index.ts"))["layoutText"];

describe.skipIf(!HAS_NATIVE_DEPS)("font registration order", () => {
  let api: Api;
  let layoutText: LayoutText;
  let regularData: Buffer;
  let boldData: Buffer;
  let warn: ReturnType<typeof vi.spyOn>;

  // Reference values from a family whose faces were all registered before
  // any lookup.
  let regularWidth: number;
  let boldWidth: number;
  let regularDark: number;
  let regularFit: number;

  let aliasCounter = 0;
  function faces() {
    const family = `Registration Order ${++aliasCounter}`;
    const regular: FontData = {
      name: family,
      weight: 400,
      style: "normal",
      data: regularData,
    };
    const bold: FontData = {
      name: family,
      weight: 700,
      style: "normal",
      data: boldData,
    };
    return { family, regular, bold };
  }

  /** What user code does: set ctx.font directly and measure. */
  function rawMeasure(family: string, weight: number): number {
    const ctx = api.createCanvas(1, 1).getContext("2d");
    ctx.font = `${weight} 60px "${family}"`;
    return ctx.measureText(TEXT).width;
  }

  function layoutWidth(family: string): number {
    return layoutText(
      TEXT,
      {
        fontSize: 60,
        fontFamily: family,
        fontWeight: 400,
        fontStyle: "normal",
      },
      10_000,
    ).width;
  }

  function fit(font: FontData): number {
    return api.findLargestUsableFontSize({
      text: TEXT,
      font,
      maxWidth: 400,
      maxHeight: 400,
      whiteSpace: "nowrap",
    });
  }

  /** Render TEXT at weight 400 through renderReactElement, count dark pixels. */
  async function renderDark(
    family: string,
    fonts: FontData[],
  ): Promise<number> {
    const canvas = api.createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    await api.renderReactElement(
      ctx,
      <div
        style={{
          display: "flex",
          width: W,
          height: H,
          backgroundColor: "white",
          color: "black",
          fontFamily: family,
          fontWeight: 400,
          fontSize: 60,
        }}
      >
        {TEXT}
      </div>,
      { fonts, emoji: "none" },
    );
    const { data } = ctx.getImageData(0, 0, W, H);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 128) dark++;
    }
    return dark;
  }

  beforeAll(async () => {
    api = await import("../src/index.ts");
    ({ layoutText } = await import("../src/jsx/text/index.ts"));
    regularData = await readFile(join(FONT_DIR, "LiberationSans-Regular.woff"));
    boldData = await readFile(join(FONT_DIR, "LiberationSans-Bold.woff"));

    const { family, regular, bold } = faces();
    api.registerFont(regular);
    api.registerFont(bold);
    regularWidth = rawMeasure(family, 400);
    boldWidth = rawMeasure(family, 700);
    regularDark = await renderDark(family, [regular, bold]);
    regularFit = fit(regular);
  });

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("registering every face before the first lookup resolves each weight to its own face", async () => {
    // Sanity check on the fixtures and the reference values.
    expect(boldWidth).toBeGreaterThan(regularWidth);

    const { family, regular, bold } = faces();
    api.registerFont(regular);
    api.registerFont(bold);
    expect(warn).not.toHaveBeenCalled();

    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);
    expect(layoutWidth(family)).toBeCloseTo(regularWidth, 3);
    expect(await renderDark(family, [regular, bold])).toBe(regularDark);
    expect(fit(regular)).toBe(regularFit);
    expect(fit(bold)).toBeLessThan(regularFit);
  });

  it("a face registered after its family/weight was looked up is still used by layout and rendering, and registerFont warns", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    // The trigger: a lookup for weight 400 while only the bold face exists.
    expect(rawMeasure(family, 400)).toBeCloseTo(boldWidth, 3);

    api.registerFont(regular);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain(`"${family}" 400 normal`);

    // Upstream behaviour: the bare ctx.font lookup stays pinned to bold. If
    // this assertion starts failing, @napi-rs/canvas invalidates its font
    // match cache on registration and the probe in registerFont can go.
    expect(rawMeasure(family, 400)).toBeCloseTo(boldWidth, 3);

    // @effing/canvas's own lookups are not affected.
    expect(layoutWidth(family)).toBeCloseTo(regularWidth, 3);
    expect(await renderDark(family, [bold, regular])).toBe(regularDark);
    expect(fit(regular)).toBe(regularFit);
  });

  it("a family looked up before any of its faces is registered is still rendered with the registered face, and registerFont warns", async () => {
    const { family, regular } = faces();
    // The trigger: a lookup while the family has no faces at all, which pins
    // the bare key to the fallback font.
    const fallbackWidth = rawMeasure(family, 400);
    expect(fallbackWidth).not.toBeCloseTo(regularWidth, 3);

    api.registerFont(regular);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain(`"${family}" 400 normal`);

    expect(layoutWidth(family)).toBeCloseTo(regularWidth, 3);
    expect(await renderDark(family, [regular])).toBe(regularDark);
  });

  it("does not warn when the weight that was looked up already had its face", () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);

    api.registerFont(regular);
    expect(warn).not.toHaveBeenCalled();
    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);
  });
});
