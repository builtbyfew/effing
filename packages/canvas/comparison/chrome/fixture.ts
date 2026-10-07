import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BUNDLED_SANS } from "../_helpers/fonts.ts";

/**
 * The family fixtures set their text in: the bundled Liberation Sans, under
 * a name no system font has (see `BUNDLED_SANS`).
 */
export const SANS = BUNDLED_SANS;

/** Where the references are: a JSON file per module, and screenshots. */
export const REFERENCES = join(
  dirname(fileURLToPath(import.meta.url)),
  "references",
);

/** A line of text as laid out: its text, where it starts, and its box. */
export type Line = {
  /**
   * The text drawn on the line: white space that collapsed left out, a
   * newline or tab that collapsed to a space a space, and the spaces that
   * hang at a soft wrap left out.
   */
  text: string;
  /** The left edge of its first character, relative to the frame. */
  x: number;
  /** From `x` to the right edge of its last character. */
  width: number;
  /** The top of its line box, relative to the frame. */
  top: number;
  /** The height of its line box. */
  height: number;
  /** Its baseline, relative to the frame. */
  baseline: number;
  /**
   * The line ends in an ellipsis (a line clamp's last, or one that
   * overflows a box with `text-overflow: ellipsis`). Chrome reports the
   * whole line's text and width, without the ellipsis, as it doesn't say
   * where it cut it.
   */
  truncated?: true;
};

/** An element with an `id`: its border box, and every line of text in it. */
export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The lines of all its text, its descendants' too, in document order. */
  lines: Line[];
};

/** What Chrome laid a fixture out as. */
export type ChromeReference = {
  /** A hash of the fixture's markup and size, to tell when it's stale. */
  hash: string;
  /** Every element in the fixture with an `id`. */
  elements: Record<string, Box>;
  /** The screenshot's file, relative to the references directory. */
  screenshot?: string;
};

/** A module's references, as `generate.tsx` writes them. */
export type ChromeReferenceFile = {
  /** Chrome's version, as it reports it. */
  chrome: string;
  /** `generatorHash()` when they were generated. */
  generator: string;
  /** The platform it ran on (`process.platform`-`process.arch`). */
  platform: string;
  fixtures: Record<string, ChromeReference>;
};

/** How far canvas may be from Chrome, in px (and % for pixels). */
export type Tolerance = {
  /** An element's edges. Yoga puts them on whole pixels. */
  box: number;
  /** A line's left edge and top. Yoga puts text boxes on whole pixels. */
  line: number;
  /** A line's width: Skia's advances against Chrome's. */
  lineWidth: number;
  /** A line box's height, and its baseline relative to its top. */
  lineBox: number;
  /** The share of pixels that may differ from the screenshot, in %. */
  pixels: number;
  /** pixelmatch's per-pixel colour threshold (0–1). */
  pixelThreshold: number;
};

export const DEFAULT_TOLERANCE: Tolerance = {
  box: 1,
  line: 1,
  lineWidth: 0.1,
  lineBox: 0.01,
  pixels: 1,
  pixelThreshold: 0.1,
};

/**
 * Values that a test held before this suite, as copied by hand from Chrome,
 * which the generated reference must agree with (to 0.01px). Any value left
 * out isn't checked.
 */
export type Transcribed = Record<
  string,
  Partial<Omit<Box, "lines">> & {
    lines?: Partial<Omit<Line, "truncated">>[];
  }
>;

export type ChromeFixture = {
  /** Its name, unique in its module: the key of its reference. */
  name: string;
  /** The frame's (canvas's) size. */
  width: number;
  height: number;
  /**
   * The element, as canvas renders it, and as Chrome renders its markup
   * (`renderToStaticMarkup`). Give every element to measure an `id`.
   */
  element: React.ReactElement;
  /** Keep a screenshot, and compare canvas's pixels with it. */
  screenshot?: boolean;
  /** Tolerances where the defaults don't hold. */
  tolerance?: Partial<Tolerance>;
  /** Values copied by hand from Chrome before, to check the reference by. */
  transcribed?: Transcribed;
  /**
   * Pixels copied by hand from a Chrome screenshot before, as (x, y, RGB),
   * which the screenshot must have, to `within` levels of each channel.
   */
  transcribedPixels?: {
    within: number;
    pixels: [number, number, [number, number, number]][];
  };
  /**
   * Where canvas is known not to lay the fixture out as Chrome does, why:
   * its layout must then differ from Chrome's, and the test fails once it
   * doesn't, for the note to go.
   */
  knownDifference?: string;
};

export type FixtureModule = {
  /** Its name, and its references' file name. */
  name: string;
  fixtures: ChromeFixture[];
};

/** A module of fixtures, whose names must be unique. */
export function fixtureModule(
  name: string,
  fixtures: ChromeFixture[],
): FixtureModule {
  const names = new Set<string>();
  const slugs = new Set<string>();
  for (const fixture of fixtures) {
    if (names.has(fixture.name)) {
      throw new Error(`Two fixtures in ${name} are named "${fixture.name}"`);
    }
    names.add(fixture.name);
    if (!fixture.screenshot) continue;
    if (slugs.has(slugOf(fixture))) {
      throw new Error(
        `Two screenshots in ${name} would be ${slugOf(fixture)}.png: name "${fixture.name}" otherwise`,
      );
    }
    slugs.add(slugOf(fixture));
  }
  return { name, fixtures };
}

/** The fixture's markup, as Chrome renders it. */
export function markupOf(fixture: ChromeFixture): string {
  return renderToStaticMarkup(fixture.element);
}

/** A hash of what Chrome lays out: the markup and the frame's size. */
export function hashOf(fixture: ChromeFixture): string {
  return createHash("sha256")
    .update(`${fixture.width}x${fixture.height}\n${markupOf(fixture)}`)
    .digest("hex")
    .slice(0, 16);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "..", "_helpers", "fonts");

/**
 * A hash of what makes the references besides the fixtures: the generator,
 * the page it lays them out on, its measurements, and the fonts. The
 * references are stale when it changes.
 */
export function generatorHash(): string {
  const hash = createHash("sha256");
  const files = [
    ...["generate.tsx", "page.css", "measure.browser.js"].map((file) =>
      join(HERE, file),
    ),
    ...readdirSync(FONTS)
      .filter((file) => file.endsWith(".woff"))
      .sort()
      .map((file) => join(FONTS, file)),
  ];
  for (const file of files) {
    hash.update(`${basename(file)}\n`).update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 16);
}

/** A file name for the fixture's screenshot. */
export function slugOf(fixture: ChromeFixture): string {
  return fixture.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * `text` quoted, for a fixture's name: as JSON, with the white space JSON
 * leaves as it is escaped too.
 */
export const quote = (text: string): string =>
  JSON.stringify(text).replace(
    /[\u00a0\u2028\u2029\u200b]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
