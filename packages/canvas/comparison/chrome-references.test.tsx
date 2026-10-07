import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import type { FontData } from "../src/types.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import {
  compareImages,
  loadFonts,
  loadScriptFonts,
  renderWithCanvas,
} from "./_helpers/setup.ts";
import {
  differences,
  layOutWithCanvas,
  readReferences,
  staleness,
  toleranceOf,
  transcriptionDifferences,
} from "./chrome/compare.ts";
import { REFERENCES } from "./chrome/fixture.ts";
import { modules } from "./chrome/fixtures/index.ts";

// Canvas against what headless Chrome makes of the same fixtures, as
// `chrome/generate.tsx` recorded it in `chrome/references/` (see README.md).
// Chrome isn't needed here: the references are committed.

const references = new Map(
  modules.map((module) => [module.name, readReferences(module)]),
);

describe("Chrome references", () => {
  for (const module of modules) {
    describe(module.name, () => {
      const file = references.get(module.name);

      it("are generated from the fixtures as they are", () => {
        const stale = module.fixtures
          .map((fixture) => staleness(fixture, file?.fixtures[fixture.name]))
          .filter((message) => message !== undefined);
        expect(stale).toEqual([]);
        const extra = Object.keys(file?.fixtures ?? {}).filter(
          (name) => !module.fixtures.some((fixture) => fixture.name === name),
        );
        expect(extra, "references for fixtures that are gone").toEqual([]);
      });

      // The pixels the tests held before, copied from Chrome's screenshots.
      const pixels = module.fixtures.filter((f) => f.transcribedPixels);
      if (pixels.length > 0) {
        it.each(pixels.map((fixture) => [fixture.name, fixture]))(
          "agree with the pixels copied before: %s",
          (_, fixture) => {
            const shot = file?.fixtures[fixture.name]?.screenshot;
            expect(shot).toBeDefined();
            const png = PNG.sync.read(readFileSync(join(REFERENCES, shot!)));
            const { within, pixels } = fixture.transcribedPixels!;
            for (const [x, y, expected] of pixels) {
              const i = (y * png.width + x) * 4;
              const actual = Array.from(png.data.subarray(i, i + 3));
              const worst = Math.max(
                ...expected.map((value, c) => Math.abs(value - actual[c]!)),
              );
              expect(
                worst,
                `(${x}, ${y}): ${actual} vs ${expected}`,
              ).toBeLessThanOrEqual(within);
            }
          },
        );
      }

      // The numbers the tests held before, which were copied by hand from
      // Chrome: the generator lays the fixtures out as Chrome did then.
      const transcribed = module.fixtures.filter((f) => f.transcribed);
      if (transcribed.length > 0) {
        it.each(transcribed.map((fixture) => [fixture.name, fixture]))(
          "agree with the numbers copied before: %s",
          (_, fixture) => {
            const reference = file?.fixtures[fixture.name];
            expect(reference).toBeDefined();
            expect(
              transcriptionDifferences(
                reference!.elements,
                fixture.transcribed!,
              ),
            ).toEqual([]);
          },
        );
      }
    });
  }
});

describe("canvas against Chrome", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = [...(await loadFonts()), ...(await loadScriptFonts())];
    ensureFontsRegistered(fonts);
  });

  for (const module of modules) {
    describe(module.name, () => {
      const file = references.get(module.name);
      for (const fixture of module.fixtures) {
        // A known difference is expected to fail, until it doesn't.
        const test = fixture.knownDifference ? it.fails : it;
        const reference = file?.fixtures[fixture.name];
        const tolerance = toleranceOf(fixture);

        test(`lays out ${fixture.name}`, async () => {
          expect(staleness(fixture, reference)).toBeUndefined();
          const canvas = await layOutWithCanvas(fixture);
          expect(differences(canvas, reference!.elements, tolerance)).toEqual(
            [],
          );
        });

        if (fixture.screenshot) {
          const paints = fixture.knownPaintDifference ? it.fails : test;
          paints(`paints ${fixture.name}`, async () => {
            expect(staleness(fixture, reference)).toBeUndefined();
            const chromePng = readFileSync(
              join(REFERENCES, reference!.screenshot!),
            );
            const canvasPng = await renderWithCanvas(
              fixture.element,
              fixture.width,
              fixture.height,
              fonts,
            );
            const { percentage } = await compareImages(
              canvasPng,
              chromePng,
              `chrome-${module.name}-${fixture.name}`,
              tolerance.pixelThreshold,
            );
            expect(percentage).toBeLessThanOrEqual(tolerance.pixels);
          });
        }
      }
    });
  }
});
