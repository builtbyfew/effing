import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontData } from "../src/types.ts";
import { HAS_NATIVE_DEPS } from "./_helpers/setup.ts";

// ---------------------------------------------------------------------------
// Fonts registered after a lookup must still be picked up. Before
// @napi-rs/canvas 1.0.9, Skia's FontCollection cached the typefaces it picked
// for each ctx.font (family list + weight + style) for the lifetime of the
// process and registration never invalidated that cache, so a family or
// weight looked up before its face existed stayed pinned to the old match
// (https://github.com/Brooooooklyn/canvas/issues/1329, fixed in
// https://github.com/Brooooooklyn/canvas/pull/1334). These tests guard the
// peer range against that.
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

  // measureText rounds widths to 1/100px; native paragraph layout
  // (EFFING_NATIVE_TEXT) doesn't, so compare layout widths to 2 decimals.
  const LAYOUT_PRECISION = 2;

  // Reference values from a family whose faces were all registered before
  // any lookup.
  let regularWidth: number;
  let boldWidth: number;
  let regularDark: number;
  let boldDark: number;

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

  function layoutWidth(family: string, weight: number): number {
    return layoutText(
      TEXT,
      {
        fontSize: 60,
        fontFamily: family,
        fontWeight: weight,
        fontStyle: "normal",
      },
      10_000,
    ).width;
  }

  /** Render TEXT through renderReactElement and count dark pixels. */
  async function renderDark(
    family: string,
    weight: number,
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
          fontWeight: weight,
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
    regularDark = await renderDark(family, 400, [regular, bold]);
    boldDark = await renderDark(family, 700, [regular, bold]);
  });

  it("resolves each weight to its own face when every face is registered before the first lookup", async () => {
    // Sanity check on the fixtures and the reference values.
    expect(boldWidth).toBeGreaterThan(regularWidth);
    expect(boldDark).toBeGreaterThan(regularDark);

    const { family, regular, bold } = faces();
    api.registerFont(regular);
    api.registerFont(bold);

    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(
      regularWidth,
      LAYOUT_PRECISION,
    );
    expect(await renderDark(family, 400, [regular, bold])).toBe(regularDark);
  });

  it("uses a face registered after a raw ctx.font lookup for its family/weight", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    // A lookup for weight 400 while only the bold face exists.
    expect(rawMeasure(family, 400)).toBeCloseTo(boldWidth, 3);

    api.registerFont(regular);

    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(
      regularWidth,
      LAYOUT_PRECISION,
    );
    expect(await renderDark(family, 400, [bold, regular])).toBe(regularDark);
  });

  it("uses a face that renderReactElement registers from options.fonts after a raw ctx.font lookup", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    // A lookup for weight 400 while only the bold face exists.
    expect(rawMeasure(family, 400)).toBeCloseTo(boldWidth, 3);

    // The regular face is only ever registered by the render path.
    expect(await renderDark(family, 400, [bold, regular])).toBe(regularDark);
    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(
      regularWidth,
      LAYOUT_PRECISION,
    );
  });

  it("uses a face registered after this package laid out text with its family/weight", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    expect(layoutWidth(family, 400)).toBeCloseTo(boldWidth, LAYOUT_PRECISION);

    api.registerFont(regular);

    expect(layoutWidth(family, 400)).toBeCloseTo(
      regularWidth,
      LAYOUT_PRECISION,
    );
    expect(await renderDark(family, 400, [bold, regular])).toBe(regularDark);
  });

  it("uses a family registered after it was looked up with no face at all", async () => {
    const { family, regular } = faces();
    // Resolves to the fallback font.
    expect(rawMeasure(family, 400)).not.toBeCloseTo(regularWidth, 3);

    api.registerFont(regular);

    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(
      regularWidth,
      LAYOUT_PRECISION,
    );
    expect(await renderDark(family, 400, [regular])).toBe(regularDark);
  });
});
