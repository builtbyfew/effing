import type React from "react";
import { SANS, fixtureModule } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";

// Text painting, compared pixel by pixel with Chrome's screenshot:
// decorations, shadows, strokes and letter spacing, in Liberation Sans on
// white, in a frame cut to the text.

const painted = (
  name: string,
  width: number,
  height: number,
  style: React.CSSProperties,
  text: React.ReactNode,
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width,
  height,
  screenshot: true,
  element: (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width,
        height,
        padding: 10,
        backgroundColor: "white",
        fontFamily: SANS,
        fontSize: 20,
      }}
    >
      <div id="t" style={style}>
        {text}
      </div>
    </div>
  ),
  ...rest,
});

/** Text without descenders, which an underline would skip. */
const UNDERLINED = "Underlined lines of text in a narrow box and more besides";

/**
 * Chrome paints -webkit-text-stroke over the fill, as `paint-order: normal`
 * has it: the half of the stroke inside the glyphs shows. Canvas paints it
 * under the fill, which covers that half.
 */
const STROKE_UNDER_FILL =
  "effing#191: canvas paints the stroke under the fill, which hides its inner half; Chrome paints it over the fill";

const fixtures: ChromeFixture[] = [
  // Decorations.
  painted(
    "underlines text",
    200,
    70,
    { fontSize: 40, textDecoration: "underline" },
    "Underlined",
    // 0.1% on macOS.
    { tolerance: { pixels: 0.2 } },
  ),
  painted(
    "skips descenders when underlining",
    200,
    70,
    { fontSize: 40, textDecoration: "underline" },
    "Hyping",
    {
      // As "underlines text" is held: the gaps are 0.6% of the frame.
      tolerance: { pixels: 0.2 },
      knownPaintDifference: {
        why: "effing#189: canvas underlines through the descenders of y, p and g; Chrome skips them (text-decoration-skip-ink: auto)",
        pixels: [0.45, 1.05],
      },
    },
  ),
  painted(
    "strikes text through",
    200,
    70,
    { fontSize: 40, textDecoration: "line-through" },
    "Hyping",
  ),
  painted(
    "overlines text",
    200,
    70,
    { fontSize: 40, textDecoration: "overline" },
    "Overlined",
    {
      knownPaintDifference: {
        why: "effing#190: canvas centres the overline 0.85em above the baseline (rows 10–13 here); Chrome paints it above the content area, its bottom at the ascent (rows 6–9), 4px higher at 40px: y = baseline − ascent − thickness / 2 for its centre",
        pixels: [6.5, 14.5],
      },
    },
  ),
  painted(
    "underlines each wrapped line",
    170,
    95,
    { width: 150, textDecoration: "underline" },
    UNDERLINED.slice(0, 33),
    {
      knownPaintDifference: {
        why: "effing#190: canvas doesn't snap an underline to whole pixels: at 20px it's 2px thick from 0.73px below the baseline, across three rows, where Chrome fills the two rows from 1px below it",
        pixels: [1.2, 2.6],
      },
    },
  ),
  painted(
    "strikes each wrapped line through",
    170,
    95,
    { width: 150, textDecoration: "line-through" },
    "Struck text that wraps onto lines",
  ),
  painted(
    "underlines a clamped line but not its ellipsis",
    220,
    70,
    {
      width: 200,
      lineClamp: 2,
      overflow: "hidden",
      textDecoration: "underline",
    },
    UNDERLINED,
    {
      knownPaintDifference: {
        why: "effing#190: canvas underlines the ellipsis of a clamped line; Chrome doesn't",
        pixels: [1.8, 4],
        ellipses: ["#t line 2"],
      },
    },
  ),

  // Shadows and strokes.
  painted(
    "casts a blurred text shadow",
    200,
    60,
    { fontSize: 32, textShadow: "2px 2px 4px #ef4444" },
    "Shadowed",
  ),
  painted(
    "casts a widely blurred text shadow",
    200,
    60,
    { fontSize: 32, textShadow: "0 0 10px #2563eb" },
    "Glowing",
    // 1.3% on macOS, where Chrome rasterises glyphs heavier, and casts a
    // heavier shadow of them.
    { tolerance: { pixels: 2 } },
  ),
  painted(
    "strokes text",
    200,
    70,
    { fontSize: 40, WebkitTextStroke: "2px #ef4444" },
    "Stroked",
    { knownPaintDifference: { why: STROKE_UNDER_FILL, pixels: [6.5, 14] } },
  ),
  painted(
    "casts a shadow of stroked text",
    200,
    70,
    {
      fontSize: 40,
      textShadow: "3px 3px 0 #ef4444",
      WebkitTextStroke: "2px #2563eb",
    },
    "Stroked",
    {
      knownPaintDifference: {
        why: `${STROKE_UNDER_FILL}; and canvas casts the shadow of the fill alone, Chrome of the stroke too`,
        pixels: [6.5, 14],
      },
    },
  ),

  // Letter spacing, as drawn.
  painted(
    "spaces letters out",
    240,
    50,
    { fontSize: 24, letterSpacing: 4 },
    "Spaced out",
  ),
  painted(
    "spaces letters in",
    240,
    50,
    { fontSize: 24, letterSpacing: -1.5 },
    "Squeezed together",
    // 1.4% on macOS, where Chrome rasterises glyphs heavier: more so where
    // they touch.
    { tolerance: { pixels: 2.5 } },
  ),
];

export default fixtureModule("text-painting", fixtures);
