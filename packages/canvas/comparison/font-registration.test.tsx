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
// registering a font later does not invalidate that cache
// (https://github.com/Brooooooklyn/canvas/issues/1329). These tests
// characterise that behaviour as seen through @effing/canvas — so we notice
// when upstream fixes it — and check the warnings we emit about it.
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

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("registering every face before the first lookup resolves each weight to its own face", async () => {
    // Sanity check on the fixtures and the reference values.
    expect(boldWidth).toBeGreaterThan(regularWidth);
    expect(boldDark).toBeGreaterThan(regularDark);

    const { family, regular, bold } = faces();
    api.registerFont(regular);
    api.registerFont(bold);

    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(await renderDark(family, 400, [regular, bold])).toBe(regularDark);
    expect(warn).not.toHaveBeenCalled();
  });

  it("measuring a weight that has a face, or skipping the measure, leaves later registrations intact", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    expect(rawMeasure(family, 700)).toBeCloseTo(boldWidth, 3);
    expect(layoutWidth(family, 700)).toBeCloseTo(boldWidth, 3);

    api.registerFont(regular);
    expect(rawMeasure(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(regularWidth, 3);
    expect(await renderDark(family, 400, [bold, regular])).toBe(regularDark);
    expect(warn).not.toHaveBeenCalled();
  });

  // The original repro. If the "still bold" assertions start failing,
  // @napi-rs/canvas has started invalidating its font match cache on
  // registration and the README section and warnings can be revisited.
  it("a raw ctx.font lookup made before its face is registered pins that family/weight to the old match for the rest of the process", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);
    // The trigger: a direct lookup for weight 400 while only bold exists.
    expect(rawMeasure(family, 400)).toBeCloseTo(boldWidth, 3);

    api.registerFont(regular);

    // Still bold, everywhere: raw lookups, our layout and our rendering.
    expect(rawMeasure(family, 400)).toBeCloseTo(boldWidth, 3);
    expect(layoutWidth(family, 400)).toBeCloseTo(boldWidth, 3);
    expect(await renderDark(family, 400, [bold, regular])).toBe(boldDark);

    // Direct ctx.font lookups are invisible to us, so nothing warned.
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when the lookup that pinned the family/weight was made through this package", async () => {
    const { family, regular, bold } = faces();
    api.registerFont(bold);

    // The trigger, this time through our own layout: warns that 400 has no
    // registered face.
    expect(layoutWidth(family, 400)).toBeCloseTo(boldWidth, 3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain(
      `No face registered for "${family}" 400 normal`,
    );

    // Registering the missing face now warns that it arrived too late...
    api.registerFont(regular);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1]![0]).toContain(
      `"${family}" 400 normal was registered after`,
    );

    // ...because it changes nothing for that lookup.
    expect(layoutWidth(family, 400)).toBeCloseTo(boldWidth, 3);
    expect(await renderDark(family, 400, [bold, regular])).toBe(boldDark);
  });
});
