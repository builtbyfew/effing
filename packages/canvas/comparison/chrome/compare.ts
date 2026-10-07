import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildLayoutTree } from "../../src/jsx/layout.ts";
import type { LayoutNode } from "../../src/jsx/layout.ts";
import { layoutText } from "../../src/jsx/text/index.ts";
import { DEFAULT_TOLERANCE, REFERENCES, hashOf } from "./fixture.ts";
import type {
  Box,
  ChromeFixture,
  ChromeReference,
  ChromeReferenceFile,
  FixtureModule,
  Line,
  Tolerance,
  Transcribed,
} from "./fixture.ts";

/** A module's references, if they've been generated. */
export function readReferences(
  module: FixtureModule,
): ChromeReferenceFile | undefined {
  const path = join(REFERENCES, `${module.name}.json`);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as ChromeReferenceFile;
}

/**
 * Why `reference` isn't the reference for `fixture` as it is, if it isn't:
 * it's missing, or was generated from other markup.
 */
export function staleness(
  fixture: ChromeFixture,
  reference: ChromeReference | undefined,
): string | undefined {
  const regenerate = "run `pnpm --filter @effing/canvas comparison:chrome`";
  if (!reference) return `no reference for "${fixture.name}": ${regenerate}`;
  if (reference.hash !== hashOf(fixture)) {
    return `the reference for "${fixture.name}" is for other markup: ${regenerate}`;
  }
  return undefined;
}

/**
 * Lay `fixture` out with canvas, and measure it as Chrome is measured: every
 * element with an `id`, its border box and its lines, relative to the frame.
 * The fonts must be registered.
 */
export async function layOutWithCanvas(
  fixture: ChromeFixture,
): Promise<Record<string, Box>> {
  const { tree } = await buildLayoutTree(
    fixture.element,
    fixture.width,
    fixture.height,
  );
  const found: Record<string, Box> = {};
  const visit = (node: LayoutNode, x: number, y: number) => {
    const left = x + node.x;
    const top = y + node.y;
    if (node.style.display === "none") return;
    const id = node.props.id;
    if (typeof id === "string") {
      found[id] = {
        x: left,
        y: top,
        width: node.width,
        height: node.height,
        lines: linesIn(node, x, y),
      };
    }
    for (const child of node.children) visit(child, left, top);
  };
  visit(tree, 0, 0);
  return found;
}

/** The lines of all text in `node`, in document order. */
function linesIn(node: LayoutNode, x: number, y: number): Line[] {
  if (node.style.display === "none") return [];
  const left = x + node.x;
  const top = y + node.y;
  const baseline = trimmedBaseline(node);
  const own = (node.textLayout?.segments ?? []).map((seg): Line => ({
    text: seg.text,
    x: left + seg.x,
    width: seg.width,
    top:
      baseline === undefined
        ? top + seg.lineIndex * seg.height
        : top + seg.y - baseline,
    height: seg.height,
    baseline: top + seg.y,
  }));
  return [
    ...own,
    ...node.children.flatMap((child) => linesIn(child, left, top)),
  ];
}

/**
 * Where the baseline is in a line box of a node whose text `textBoxTrim`
 * trims at the start, if it does: the trim moves the text up, line boxes and
 * all, as in Chrome, where the first line box starts above the element.
 */
function trimmedBaseline(node: LayoutNode): number | undefined {
  const { textBoxTrim } = node.style;
  if (textBoxTrim !== "trim-start" && textBoxTrim !== "trim-both") return;
  if (node.textContent === undefined) return;
  const untrimmed = layoutText(
    node.textContent,
    { ...node.style, textBoxTrim: "none" },
    node.width,
  );
  return untrimmed.segments[0]?.y;
}

/**
 * A line's text, to compare: without the spaces at its end, which canvas
 * leaves out where they hang; without control characters, which either
 * draws as nothing or as a box whose width tells; and with a line or
 * paragraph separator a no-break space, as canvas lays it out (with a
 * zero-width space after it, for the break there).
 */
export const comparable = (text: string) =>
  text
    .replace(/[\u2028\u2029]/g, "\u00a0")
    .replace(/[\u200b\r\f\v]/g, "")
    .trimEnd();

const fmt = (value: number) => String(Math.round(value * 1000) / 1000);

/**
 * Where canvas's layout of a fixture is further from Chrome's than
 * `tolerance`, as a list of messages: none where it isn't.
 */
export function differences(
  canvas: Record<string, Box>,
  chrome: Record<string, Box>,
  tolerance: Tolerance,
): string[] {
  const found: string[] = [];
  const near = (
    what: string,
    actual: number,
    expected: number,
    within: number,
  ) => {
    if (!(Math.abs(actual - expected) <= within + 1e-9)) {
      found.push(
        `${what}: canvas ${fmt(actual)}, Chrome ${fmt(expected)} (±${within})`,
      );
    }
  };
  for (const [id, expected] of Object.entries(chrome)) {
    const actual = canvas[id];
    if (!actual) {
      found.push(`#${id}: not in canvas's layout`);
      continue;
    }
    for (const edge of ["x", "y", "width", "height"] as const) {
      near(`#${id} ${edge}`, actual[edge], expected[edge], tolerance.box);
    }
    const texts = (lines: Line[]) => lines.map((line) => line.text);
    if (actual.lines.length !== expected.lines.length) {
      found.push(
        `#${id} lines: canvas ${JSON.stringify(texts(actual.lines))}, Chrome ${JSON.stringify(texts(expected.lines))}`,
      );
      continue;
    }
    expected.lines.forEach((line, i) => {
      const got = actual.lines[i]!;
      const what = `#${id} line ${i + 1}`;
      // Chrome doesn't say where it cut a truncated line: canvas's text
      // (without its ellipsis) is the start of it.
      const [chromeText, canvasText] = [line.text, got.text].map(comparable);
      const textMatches = line.truncated
        ? chromeText!.startsWith(canvasText!)
        : chromeText === canvasText;
      if (!textMatches) {
        found.push(
          `${what}: canvas ${JSON.stringify(got.text)}, Chrome ${JSON.stringify(line.text)}${line.truncated ? " (truncated)" : ""}`,
        );
      }
      near(`${what} x`, got.x, line.x, tolerance.line);
      near(`${what} top`, got.top, line.top, tolerance.line);
      near(`${what} height`, got.height, line.height, tolerance.lineBox);
      near(
        `${what} baseline in its line box`,
        got.baseline - got.top,
        line.baseline - line.top,
        tolerance.lineBox,
      );
      // Canvas measures a truncated line with its ellipsis.
      if (!line.truncated) {
        near(`${what} width`, got.width, line.width, tolerance.lineWidth);
      }
    });
  }
  return found;
}

/** The tolerance for `fixture`. */
export const toleranceOf = (fixture: ChromeFixture): Tolerance => ({
  ...DEFAULT_TOLERANCE,
  ...fixture.tolerance,
});

/**
 * Where the reference doesn't hold the values copied by hand from Chrome
 * before, to `within` px (they were rounded to 0.01px).
 */
export function transcriptionDifferences(
  chrome: Record<string, Box>,
  transcribed: Transcribed,
  within = 0.01,
): string[] {
  const found: string[] = [];
  const near = (what: string, actual: number, expected: number) => {
    if (!(Math.abs(actual - expected) <= within + 1e-9)) {
      found.push(`${what}: generated ${fmt(actual)}, copied ${expected}`);
    }
  };
  for (const [id, expected] of Object.entries(transcribed)) {
    const box = chrome[id];
    if (!box) {
      found.push(`#${id}: not in the reference`);
      continue;
    }
    for (const edge of ["x", "y", "width", "height"] as const) {
      const value = expected[edge];
      if (value !== undefined) near(`#${id} ${edge}`, box[edge], value);
    }
    if (!expected.lines) continue;
    if (box.lines.length !== expected.lines.length) {
      found.push(
        `#${id}: generated ${box.lines.length} lines (${JSON.stringify(box.lines.map((l) => l.text))}), copied ${expected.lines.length}`,
      );
      continue;
    }
    expected.lines.forEach((line, i) => {
      const got = box.lines[i]!;
      const what = `#${id} line ${i + 1}`;
      if (
        line.text !== undefined &&
        comparable(line.text) !== comparable(got.text)
      ) {
        found.push(
          `${what}: generated ${JSON.stringify(got.text)}, copied ${JSON.stringify(line.text)}`,
        );
      }
      for (const key of ["x", "width", "top", "height", "baseline"] as const) {
        const value = line[key];
        if (value !== undefined) near(`${what} ${key}`, got[key], value);
      }
    });
  }
  return found;
}
