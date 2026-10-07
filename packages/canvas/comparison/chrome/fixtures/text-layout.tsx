import { SCRIPT_FONT_FAMILIES } from "../../_helpers/fonts.ts";
import { fixtureModule, quote } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";
import { paragraph } from "./paragraph.tsx";

// Text layout that no other module covers: justification, right-to-left
// text, tabs, soft hyphens, text-transform, line clamps with other text
// styles, text-box-edge, italic and synthesized faces, and the line boxes of
// fallback fonts and of a font with another line gap. 20px Liberation Sans
// unless a case says otherwise.

const TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

/** Hebrew, which Liberation Sans hasn't: Noto Sans Hebrew draws it. */
const HEBREW = "Noto Sans Hebrew, Liberation Sans";
const SHALOM = "שלום עולם, מה שלומך היום? הכל טוב מאוד";

/**
 * Chrome draws an ellipsis as three full stops where the first font has no
 * "…", as Noto Sans Hebrew hasn't; canvas draws "…" from the next font.
 */
const THREE_DOTS =
  'Chrome draws the ellipsis as three full stops ("...") where the first font has no "…" (Noto Sans Hebrew), canvas draws "…" from Liberation Sans';

/**
 * Chrome places the baseline in a line box of a set height by the font's
 * ascent and descent rounded to whole pixels, before it trims it (see
 * `HALF_LEADING` in `native-text.tsx`).
 */
const HALF_LEADING =
  "canvas puts the baseline in a line box of a set height 0.07px higher: half the leading from the unrounded ascent and descent, where Chrome rounds them";

/** A fixture's pixels too, in a frame cut to its text. */
const shot = (
  fixture: ChromeFixture,
  width: number,
  height: number,
): ChromeFixture => ({ ...fixture, width, height, screenshot: true });

const fixtures: ChromeFixture[] = [
  // Justification: every line but the last stretched to the box, at its
  // spaces; a line of one word, and one that ends at a forced break, not.
  paragraph(
    "justifies the lines but the last",
    TEXT,
    { textAlign: "justify" },
    200,
  ),
  paragraph(
    "doesn't justify a line of a single word",
    "Supercalifragilistic is a word too long to share a line",
    { textAlign: "justify" },
    210,
  ),
  paragraph(
    "doesn't justify a line that ends at a forced break",
    "The quick brown fox\njumps over the lazy dog again and again",
    { textAlign: "justify", whiteSpace: "pre-line" },
    250,
  ),
  paragraph(
    "justifies letter-spaced lines",
    TEXT,
    { textAlign: "justify", letterSpacing: 2 },
    220,
  ),

  // Right-to-left text, in a paragraph of left-to-right base direction
  // (canvas has no `direction`): each line's runs reordered, the line still
  // aligned by `textAlign`.
  paragraph("wraps Hebrew", SHALOM, { fontFamily: HEBREW }, 150),
  paragraph(
    "right-aligns Hebrew",
    SHALOM,
    { fontFamily: HEBREW, textAlign: "right" },
    150,
  ),
  paragraph(
    "wraps Hebrew mixed with Latin and digits",
    "Hello שלום עולם and 123 more words בעברית 456 end",
    { fontFamily: HEBREW },
    170,
  ),
  shot(
    paragraph(
      "truncates Hebrew with an ellipsis",
      SHALOM,
      {
        fontFamily: HEBREW,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
      150,
      undefined,
      {
        knownPaintDifference: `canvas keeps the visual left of the line, the end of the Hebrew text ("…ום? הכל טוב מאוד"), with no ellipsis in the box, where Chrome keeps its start and ends it in an ellipsis on the left ("...שלום עולם, מה"); and ${THREE_DOTS}`,
      },
    ),
    160,
    30,
  ),
  shot(
    paragraph(
      "clamps Hebrew to two lines",
      SHALOM,
      { fontFamily: HEBREW, lineClamp: 2, overflow: "hidden" },
      120,
      undefined,
      { knownPaintDifference: THREE_DOTS },
    ),
    130,
    50,
  ),

  // Tabs, which `pre` and `pre-wrap` keep.
  ...(["pre", "pre-wrap"] as const).map((whiteSpace) =>
    paragraph(
      `puts tabs at tab stops under ${whiteSpace}`,
      "a\tbc\tdef\tg\nabcdefghij\tk",
      { whiteSpace },
      380,
      undefined,
      {
        knownDifference:
          "canvas draws a tab one space wide (as its README says), where CSS advances it to the next tab stop, 8 spaces apart (tab-size: 8)",
      },
    ),
  ),

  // Soft hyphens: drawn as nothing, unless a line breaks at one, where a
  // hyphen is drawn.
  paragraph(
    "draws an unbroken soft hyphen as nothing",
    "super\u00adcali\u00adfragilistic",
    {},
    380,
  ),
  shot(
    paragraph(
      "breaks a line at a soft hyphen",
      "super\u00adcali\u00adfragilistic\u00adexpiali\u00addocious",
      {},
      130,
      undefined,
      {
        knownDifference:
          "canvas breaks the line at the soft hyphen but draws no hyphen there: its lines are 6.67px (a hyphen) narrower than Chrome's",
      },
    ),
    140,
    75,
  ),

  // text-transform.
  ...(
    [
      ["uppercase", "Hello world, straße"],
      ["lowercase", "HELLO World ΣΑΣ"],
      ["capitalize", "hello wide world of text"],
    ] as const
  ).map(([textTransform, text]) =>
    paragraph(
      `transforms ${quote(text)} to ${textTransform}`,
      text,
      { textTransform },
      380,
    ),
  ),
  paragraph(
    `transforms ${quote("it's o'neil's x-ray, élan and 3d")} to capitalize`,
    "it's o'neil's x-ray, élan and 3d",
    { textTransform: "capitalize" },
    380,
    undefined,
    {
      knownDifference:
        "canvas capitalizes after an apostrophe and only ASCII letters (\"It'S O'Neil'S X-Ray, éLan And 3d\"), where Chrome capitalizes each word as ICU finds them (\"It's O'neil's X-Ray, Élan And 3d\")",
    },
  ),
  paragraph(
    "wraps uppercased text",
    "Hello world, pack my box with five dozen liquor jugs now",
    { textTransform: "uppercase" },
    200,
  ),

  // Kerning with the space a line wraps at.
  paragraph(
    "measures a line that starts after a space it kerns with",
    "Over Away Yes Tea",
    {},
    60,
    undefined,
    {
      knownDifference:
        'canvas measures a line that starts after the space it wraps at, where the font kerns that space with the line\'s first letter ("space A", "space Y", "space T" in Liberation Sans), half that kerning narrower than Chrome (0.55px for "Away", 0.18px for "Yes" and "Tea")',
    },
  ),

  // Line clamps with other text styles.
  ...(
    [
      // Their pixels differ by 0.9% and 1.5% on macOS, where Chrome
      // rasterises glyphs heavier.
      ["letter-spaced", { letterSpacing: 3 }, { tolerance: { pixels: 1.5 } }],
      [
        "uppercased",
        { textTransform: "uppercase" },
        { tolerance: { pixels: 2.5 } },
      ],
      [
        "centred",
        { textAlign: "center" },
        {
          knownDifference:
            "Chrome aligns a clamped line as if it had no ellipsis, and the ellipsis follows it, out of the box; canvas aligns the line with its ellipsis",
        },
      ],
      [
        "right-aligned",
        { textAlign: "right" },
        {
          knownDifference:
            "Chrome aligns a clamped line as if it had no ellipsis, and the ellipsis follows it, out of the box; canvas aligns the line with its ellipsis",
        },
      ],
      [
        "justified",
        { textAlign: "justify" },
        {
          knownPaintDifference:
            'Chrome justifies the clamped line, as a line that isn\'t the paragraph\'s last, and cuts it for the ellipsis ("jumps over the la…"); canvas doesn\'t justify it ("jumps over the lazy…")',
        },
      ],
    ] as const
  ).map(([what, style, rest]) =>
    shot(
      paragraph(
        `clamps ${what} text to two lines`,
        TEXT,
        { lineClamp: 2, overflow: "hidden", ...style },
        200,
        undefined,
        rest,
      ),
      210,
      50,
    ),
  ),

  // text-box-edge, trimming normal line boxes, at the box's top left: the
  // line boxes trimmed are as precise as their baselines.
  ...(
    [
      ["text alphabetic", {}],
      [
        "cap alphabetic",
        {
          knownDifference:
            'canvas trims to the top of "H" as measureText bounds it, rounded out to whole pixels (14px above the baseline at 20px), where Chrome trims to the font\'s cap height (13.77px)',
        },
      ],
      [
        "ex alphabetic",
        {
          knownDifference:
            'canvas trims to the top of "x" as measureText bounds it, rounded out to whole pixels (11px above the baseline at 20px), where Chrome trims to the font\'s x-height (10.57px)',
        },
      ],
    ] as const
  ).map(([textBoxEdge, rest]) =>
    paragraph(
      `trims to ${textBoxEdge}, normal lines`,
      "Hxg\nHxg",
      { whiteSpace: "pre", textBoxTrim: "trim-both", textBoxEdge },
      1000,
      undefined,
      { tolerance: { line: 0.01 }, ...rest },
    ),
  ),
  // And line boxes of a set height.
  ...(
    [
      ["text", "trim-both"],
      ["cap alphabetic", "trim-both"],
      ["cap alphabetic", "trim-start"],
      ["ex alphabetic", "trim-end"],
    ] as const
  ).map(([textBoxEdge, textBoxTrim]) =>
    paragraph(
      `trims to ${textBoxEdge} (${textBoxTrim}), 30px lines`,
      "Hxg\nHxg",
      { whiteSpace: "pre", lineHeight: "30px", textBoxTrim, textBoxEdge },
      1000,
      undefined,
      { knownDifference: HALF_LEADING },
    ),
  ),

  // Faces: italic and bold in the faces bundled, and synthesized where
  // there's none.
  paragraph("lays out italic text", TEXT, { fontStyle: "italic" }, 200),
  paragraph("lays out bold text", TEXT, { fontWeight: 700 }, 200),
  shot(
    paragraph(
      "lays out bold italic text, which no face is",
      TEXT,
      { fontWeight: 700, fontStyle: "italic" },
      200,
      undefined,
      {
        knownDifference:
          "there's no bold italic face: Chrome matches the style before the weight, as CSS does, and draws the italic face in synthesized bold (the regular widths); canvas draws the bold face slanted, and breaks its wider lines elsewhere",
      },
    ),
    210,
    120,
  ),
  // The advances only: Chrome on macOS emboldens more lightly than canvas.
  paragraph(
    "synthesizes bold where there's no bold face",
    "Synthetic bold text here",
    { fontFamily: "Poppins", fontWeight: 700 },
    380,
  ),
  shot(
    paragraph(
      "synthesizes italic where there's no italic face",
      "Synthetic italic text here",
      { fontFamily: "Poppins", fontStyle: "italic" },
      380,
      undefined,
      // 0.95% on macOS, where Chrome rasterises glyphs heavier.
      { tolerance: { pixels: 1.5 } },
    ),
    300,
    35,
  ),

  // Line boxes of `line-height: normal` that a fallback font grows: the
  // first font's ascent, descent and line gap, and those of every font that
  // draws some of the line.
  paragraph(
    "grows a normal line box for a fallback font (Hebrew)",
    "Hello שלום world",
    { fontFamily: "Liberation Sans, Noto Sans Hebrew" },
    380,
    undefined,
    {
      knownDifference:
        "effing#181: canvas sizes a normal line box from the first font alone; Chrome grows it to fit Noto Sans Hebrew, which draws part of the line (27px, not 23px)",
    },
  ),
  paragraph(
    "grows a normal line box for a fallback font (Thai)",
    "Hello สวัสดี world",
    { fontFamily: `Liberation Sans, ${SCRIPT_FONT_FAMILIES}` },
    380,
    undefined,
    {
      knownDifference:
        "effing#181: canvas sizes a normal line box from the first font alone; Chrome grows it to fit Noto Sans Thai, which draws part of the line (30px, not 23px)",
    },
  ),
  paragraph(
    "keeps a normal line box for a fallback font that fits in it",
    "שלום Hello world",
    { fontFamily: HEBREW },
    380,
  ),

  // A line gap other than Liberation Sans's: Poppins has 100 units of 1000.
  ...[13.5, 20, 33].map((fontSize) =>
    paragraph(
      `line-height: normal, Poppins at ${fontSize}px`,
      "Hello wide world of text",
      { fontFamily: "Poppins", fontSize },
      fontSize * 6,
    ),
  ),
];

export default fixtureModule("text-layout", fixtures);
