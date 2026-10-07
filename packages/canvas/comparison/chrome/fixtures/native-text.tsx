import { fixtureModule, quote } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";
import { paragraph, texts } from "./paragraph.tsx";

// Cases of native-text.test.tsx that hold Chrome's numbers: 20px Liberation
// Sans in a box of the width given, unless a case says otherwise.

const TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";
const LONG = "A supercalifragilisticexpialidocious word here";

/** `line-height: normal` (font, size, line box, baseline in it). */
const NORMAL_LINE_BOXES = [
  ["Liberation Sans", 11, 12, 10],
  ["Liberation Sans", 13.5, 15, 12],
  ["Liberation Sans", 16, 18, 14],
  ["Liberation Sans", 20, 23, 18],
  ["Liberation Sans", 33, 38, 30],
  ["Liberation Sans", 48, 55, 44],
  ["Noto Sans Thai", 11, 17, 12],
  ["Noto Sans Thai", 13.5, 20, 14],
  ["Noto Sans Thai", 16, 24, 17],
  ["Noto Sans Thai", 20, 30, 21],
  ["Noto Sans Thai", 33, 50, 35],
  ["Noto Sans Thai", 48, 73, 51],
  ["Noto Sans Lao", 11, 18, 13],
  ["Noto Sans Lao", 13.5, 22, 16],
  ["Noto Sans Lao", 16, 26, 19],
  ["Noto Sans Lao", 20, 33, 24],
  ["Noto Sans Lao", 33, 54, 39],
  ["Noto Sans Lao", 48, 79, 57],
  ["Noto Sans Myanmar", 11, 24, 15],
  ["Noto Sans Myanmar", 13.5, 30, 18],
  ["Noto Sans Myanmar", 16, 35, 21],
  ["Noto Sans Myanmar", 20, 43, 26],
  ["Noto Sans Myanmar", 33, 72, 44],
  ["Noto Sans Myanmar", 48, 105, 64],
] as const;

/** Three lines of a line box `height`, the baseline `baseline` down it. */
const lineBoxes = (count: number, height: number, baseline: number) => ({
  height: count * height,
  lines: Array.from({ length: count }, (_, i) => ({
    top: i * height,
    height,
    baseline: i * height + baseline,
  })),
});

/**
 * Chrome puts the baseline in a line box of a set height half the leading
 * below the rounded ascent (as for `normal`): 22px down a 30px line box at
 * 20px, where canvas, from the unrounded ascent and descent, puts it at
 * 21.93px.
 */
const HALF_LEADING =
  "canvas puts the baseline in a line box of a set height 0.07px higher: half the leading from the unrounded ascent and descent, where Chrome rounds them";

/**
 * "A" on a line of its own, before a wrap, is 12.8px in Chrome, and in
 * canvas on macOS; on Linux, canvas makes it 12.24px.
 */
const A_ON_ITS_OWN = { lineWidth: 0.6 };

const fixtures: ChromeFixture[] = [
  ...(
    [
      [LONG, 80, ["A", "supercalifragilisticexpialidocious", "word", "here"]],
      [LONG, 120, ["A", "supercalifragilisticexpialidocious", "word here"]],
      ["over lazy here", 39, ["over", "lazy", "here"]],
    ] as const
  ).map(([text, width, lines]) =>
    paragraph(
      `leaves a word wider than the box unbroken: ${text} at ${width}px`,
      text,
      {},
      width,
      texts(lines),
      text === LONG ? { tolerance: A_ON_ITS_OWN } : {},
    ),
  ),
  ...(
    [
      [
        LONG,
        80,
        ["A", "supercal", "ifragilisti", "cexpialid", "ocious", "word", "here"],
      ],
      [
        LONG,
        120,
        ["A", "supercalifragi", "listicexpialido", "cious word", "here"],
      ],
      ["over lazy here", 39, ["over", "lazy", "her", "e"]],
      [
        "supercalifragilisticexpialidocious",
        100,
        ["supercalifr", "agilisticexp", "ialidocious"],
      ],
      ["The quick brown fox", 30, ["Th", "e", "qui", "ck", "bro", "wn", "fox"]],
    ] as const
  ).flatMap(([text, width, lines]) =>
    (
      [
        ["word-break", { wordBreak: "break-word" }],
        ["overflow-wrap", { overflowWrap: "break-word" }],
      ] as const
    ).map(([property, style]) =>
      paragraph(
        `breaks a word wider than the box under ${property}: break-word: ${text} at ${width}px`,
        text,
        style,
        width,
        texts(lines),
        text === LONG ? { tolerance: A_ON_ITS_OWN } : {},
      ),
    ),
  ),
  ...(
    [
      [
        TEXT,
        69,
        [
          "The qui",
          "ck brow",
          "n fox ju",
          "mps ov",
          "er the l",
          "azy do",
          "g. Pack",
          "my box",
          "with fiv",
          "e doze",
          "n liquor",
          "jugs.",
        ],
      ],
      [
        TEXT,
        105,
        [
          "The quick b",
          "rown fox ju",
          "mps over th",
          "e lazy dog.",
          "Pack my bo",
          "x with five d",
          "ozen liquor",
          "jugs.",
        ],
      ],
      [
        TEXT,
        150,
        [
          "The quick brown",
          "fox jumps over t",
          "he lazy dog. Pac",
          "k my box with fiv",
          "e dozen liquor ju",
          "gs.",
        ],
      ],
      [
        LONG,
        100,
        ["A supercali", "fragilisticex", "pialidociou", "s word her", "e"],
      ],
    ] as const
  ).map(([text, width, lines], i) =>
    paragraph(
      `breaks between any two letters under break-all ${i + 1}, at ${width}px`,
      text,
      { wordBreak: "break-all" },
      width,
      texts(lines),
    ),
  ),
  ...(["pre", "pre-wrap"] as const).map((whiteSpace) =>
    paragraph(
      `keeps the trailing spaces of white-space: ${whiteSpace} in the line`,
      "Hello   \nab",
      { whiteSpace, textAlign: "right" },
      300,
      {
        lines: [
          { text: "Hello   ", x: 237.75, width: 300 - 237.75 },
          { text: "ab", x: 277.75 },
        ],
      },
    ),
  ),
  ...(
    [
      ["An overflowing title", { whiteSpace: "nowrap" }],
      ["Supercalifragilistic", {}],
    ] as const
  ).flatMap(([text, style]) =>
    (["center", "right"] as const).map((textAlign) =>
      paragraph(
        `start-aligns a line that overflows: ${text}, ${textAlign}`,
        text,
        { ...style, textAlign },
        100,
        { lines: [{ x: 0 }] },
      ),
    ),
  ),
  paragraph("puts letter spacing after each glyph", "Hello", {}, 300),
  paragraph(
    "puts letter spacing after each glyph, 3px of it",
    "Hello",
    { letterSpacing: 3 },
    300,
  ),
  paragraph(
    "places lines on half-leading baselines",
    TEXT,
    { lineHeight: "30px" },
    200,
    undefined,
    { knownDifference: HALF_LEADING },
  ),
  paragraph(
    "collapses the line boxes for a line height of 0",
    "Hello world again",
    { lineHeight: 0 },
    80,
    { height: 0, ...texts(["Hello", "world", "again"]) },
    { knownDifference: HALF_LEADING },
  ),
  paragraph(
    "gives text of no font size no line boxes",
    "Hello world",
    { fontSize: 0 },
    100,
    {
      height: 0,
    },
  ),
  ...NORMAL_LINE_BOXES.map(([fontFamily, fontSize, height, baseline]) =>
    paragraph(
      `line-height: normal, ${fontFamily} at ${fontSize}px`,
      "Hg Hg Hg",
      { fontFamily, fontSize },
      1,
      lineBoxes(3, height, baseline),
      // The Noto fonts have no "H" or "g": Chrome draws them in a system
      // font, and canvas in its own fallback.
      fontFamily === "Liberation Sans"
        ? {}
        : { tolerance: { lineWidth: Infinity } },
    ),
  ),
  paragraph(
    "line-height: normal, three lines of Liberation Sans at 20px",
    "Hg\nHg\nHg",
    { whiteSpace: "pre" },
    1000,
    lineBoxes(3, 23, 18),
  ),
  paragraph(
    "line-height: normal, a bold face",
    "Hg",
    { fontSize: 48, fontWeight: 700 },
    1000,
    lineBoxes(1, 55, 44),
  ),
  paragraph(
    "line-height: normal, clamped to whole line boxes",
    TEXT,
    { lineClamp: 2 },
    300,
    { height: 46 },
  ),
  ...(
    [
      [13.5, "trim-both", 30],
      [20, "trim-start", 46],
      [20, "trim-end", 45],
      [20, "trim-both", 45],
      [33, "trim-both", 75],
    ] as const
  ).map(([fontSize, textBoxTrim, height]) =>
    paragraph(
      `line-height: normal, trims two lines at ${fontSize}px (${textBoxTrim})`,
      "Hg\nHg",
      { fontSize, whiteSpace: "pre", textBoxTrim },
      1000,
      { height },
    ),
  ),
  // The clamped line is its own text with an ellipsis after it, cut to fit:
  // Chrome's whole line is canvas's, and more.
  ...(
    [
      ["ab cd efgh ij", "normal", 90],
      ["aaaa bb cccc", "normal", 100],
      ["aaaa bb cccc", "normal", 110],
      ["aaaa bb   cccc", "pre-wrap", 100],
      ["aaaa bb   cccc", "pre-wrap", 120],
    ] as const
  ).map(([text, whiteSpace, width]) =>
    paragraph(
      `truncates ${quote(text)} (${whiteSpace}) clamped to a line at ${width}px`,
      text,
      { lineClamp: 1, whiteSpace, overflow: "hidden" },
      width,
    ),
  ),
];

export default fixtureModule("native-text", fixtures);
