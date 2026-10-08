import type React from "react";
import { fixtureModule, quote, SANS, intentional } from "../fixture.ts";
import type { ChromeFixture, Transcribed } from "../fixture.ts";
import { paragraph, texts } from "./paragraph.tsx";

// Cases of white-space.test.tsx that hold Chrome's numbers: 20px Liberation
// Sans in a 300px box, right-aligned unless a case says otherwise.

type WhiteSpace = NonNullable<React.CSSProperties["whiteSpace"]>;

/** Right-aligned lines of `text`, and where each starts (null: anywhere). */
const lines = (
  name: string,
  text: string,
  whiteSpace: WhiteSpace,
  expected: readonly string[] | null,
  x: readonly (number | null)[],
  width = 300,
  style: React.CSSProperties = {},
) =>
  paragraph(name, text, { whiteSpace, textAlign: "right", ...style }, width, {
    lines: x.map((left, i) => ({
      ...(expected && { text: expected[i] }),
      ...(left !== null && { x: left }),
    })),
  });

const COLLAPSING = ["normal", "nowrap", "pre-line"] as const;
const ALL = ["normal", "nowrap", "pre-line", "pre", "pre-wrap"] as const;

/** Elements and text in a 300px flex box (`id="c"`), as `layOut` has it. */
const between = (
  name: string,
  children: React.ReactNode,
  style: React.CSSProperties,
  transcribed?: Transcribed,
): ChromeFixture => ({
  name,
  width: 400,
  height: 400,
  element: (
    <div
      id="c"
      style={{
        display: "flex",
        alignItems: "flex-start",
        width: 300,
        fontFamily: SANS,
        fontSize: 20,
        ...style,
      }}
    >
      {children}
    </div>
  ),
  transcribed,
});

/** An element of nothing but `text` (`id="e"`), in a column. */
const alone = (
  name: string,
  text: string,
  style: React.CSSProperties,
  transcribed?: Transcribed["e"],
): ChromeFixture => ({
  name,
  width: 400,
  height: 400,
  element: (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        fontFamily: SANS,
        fontSize: 20,
      }}
    >
      <div id="e" style={style}>
        {text}
      </div>
    </div>
  ),
  transcribed: transcribed && { e: transcribed },
});

const fixtures: ChromeFixture[] = [
  ...(
    [
      ["a\nb", "normal", ["a b"], [272.19]],
      ["a\nb", "nowrap", ["a b"], [272.19]],
      ["a\nb", "pre-line", ["a", "b"], [288.88, 288.88]],
      ["a  \n  b", "normal", ["a b"], [272.19]],
      ["a  \n  b", "nowrap", ["a b"], [272.19]],
      ["a  \n  b", "pre-line", ["a", "b"], [288.88, 288.88]],
      ["a\r\nb", "normal", ["a b"], [272.19]],
      ["a\r\nb", "pre-line", ["a", "b"], [288.88, 288.88]],
      ["a\rb", "pre-line", ["a b"], [272.19]],
      ["a\n\n\nb", "normal", ["a b"], [272.19]],
      [
        "a\n\n\nb",
        "pre-line",
        ["a", "", "", "b"],
        [288.88, null, null, 288.88],
      ],
      ["Hello \n ", "pre-line", ["Hello"], [254.42]],
    ] as const
  ).map(([text, whiteSpace, expected, x]) =>
    lines(
      `breaks ${quote(text)} under ${whiteSpace}`,
      text,
      whiteSpace,
      expected,
      x,
    ),
  ),
  ...COLLAPSING.flatMap((whiteSpace) =>
    (
      [
        ["a\tb\t\tc", "a b c", 256.64],
        ["a     b", "a b", 272.19],
        ["   Hello world   ", "Hello world", 201.06],
        ["a   b", "a   b", 261.08],
      ] as const
    ).map(([text, line, x]) =>
      lines(
        `collapses ${quote(text)} under ${whiteSpace}`,
        text,
        whiteSpace,
        [line],
        [x],
      ),
    ),
  ),
  ...(["normal", "pre-line"] as const).map((whiteSpace) =>
    lines(
      `wraps collapsed text under ${whiteSpace}, hanging the space at each wrap`,
      "Hello   world   again   and   more   words   here",
      whiteSpace,
      ["Hello world", "again and more", "words here"],
      [51.06, 11.02, 51.06],
      150,
    ),
  ),
  paragraph(
    "doesn't wrap collapsed text under nowrap",
    "Hello   world   again   and   more   words   here",
    { whiteSpace: "nowrap" },
    150,
    {
      lines: [{ text: "Hello world again and more words here", width: 347.97 }],
    },
  ),
  ...(["pre", "pre-wrap"] as const).flatMap((whiteSpace) =>
    (
      [
        ["a  \n  b", ["a  ", "  b"], [277.75, 277.75]],
        ["a     b", ["a     b"], [249.97]],
        // white-space.test.tsx has 167.73 for both, pre's.
        [
          "   Hello world   ",
          ["   Hello world   "],
          [whiteSpace === "pre" ? 167.73 : 167.72],
        ],
      ] as const
    ).map(([text, expected, x]) =>
      lines(
        `keeps ${quote(text)} under ${whiteSpace}`,
        text,
        whiteSpace,
        expected,
        x,
      ),
    ),
  ),
  lines(
    "keeps the spaces that start a line under pre-wrap, at a soft wrap",
    "  ab cd",
    "pre-wrap",
    ["", "ab", "cd"],
    [null, null, null],
    30,
    { textAlign: "left" },
  ),
  lines(
    "keeps the spaces that start a line under pre-wrap, after a newline",
    "ab\n  cd ef",
    "pre-wrap",
    ["ab", "  cd ef"],
    [277.75, 245.52],
  ),
  ...(["pre", "pre-wrap"] as const).flatMap((whiteSpace) => [
    paragraph(
      `draws a lone CR as nothing under ${whiteSpace}`,
      "a\rb",
      { whiteSpace },
      300,
      { lines: [{ width: 22.25 }] },
    ),
    ...(
      [
        ["AV", 50.39],
        ["A\rV", 53.38],
        ["T\ro", 46.69],
      ] as const
    ).map(([text, width]) =>
      paragraph(
        `breaks the kerning at a lone CR under ${whiteSpace}: ${quote(text)}`,
        text,
        { whiteSpace, fontSize: 40 },
        1000,
        { lines: [{ width }] },
      ),
    ),
  ]),
  ...(["pre-line", "pre", "pre-wrap"] as const).flatMap((whiteSpace) =>
    (
      [
        ["Hello\n", ["Hello"]],
        ["a\r\n", ["a"]],
        ["a\n\n", ["a", ""]],
      ] as const
    ).map(([text, expected]) =>
      paragraph(
        `starts no line after a newline that ends ${quote(text)} under ${whiteSpace}`,
        text,
        { whiteSpace },
        300,
        texts(expected),
      ),
    ),
  ),
  paragraph(
    "clamps the collapsed lines",
    "Hello   world\n  again and\tmore\r\nwords here",
    { lineClamp: 2, overflow: "hidden" },
    150,
    { lines: [{ text: "Hello world" }, {}] },
    // 1.1% measured, where the ellipsis's end is checked on its own.
    { screenshot: true, width: 180, height: 56, tolerance: { pixels: 2.5 } },
  ),
  paragraph(
    "truncates nowrap text on one line",
    "Hello   world\n  again and\tmore\r\nwords here",
    { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" },
    150,
    { height: 23, lines: [{}] },
    // 1.4% measured, where the ellipsis's end is checked on its own.
    { screenshot: true, width: 180, height: 30, tolerance: { pixels: 3 } },
  ),
  paragraph(
    "collapses before text-transform",
    "hello \n\t world",
    { textTransform: "capitalize" },
    300,
  ),

  // Each run of text between elements is a flex item of its own.
  between(
    "doesn't render a run of nothing but white space",
    [
      <span key="a" id="a">
        a
      </span>,
      " ",
      <span key="b" id="b">
        b
      </span>,
    ],
    { gap: 10 },
    { a: { x: 0 }, b: { x: 21.13 } },
  ),
  between(
    "renders a run of no-break spaces",
    [
      <span key="a" id="a">
        a
      </span>,
      " ",
      <span key="b" id="b">
        b
      </span>,
    ],
    { flexDirection: "column" },
    { a: { y: 0 }, b: { y: 46 } },
  ),
  between(
    "lays adjacent text out as one run",
    [
      <span key="a">a</span>,
      "Hello ",
      "World",
      <span key="b" id="b">
        b
      </span>,
    ],
    {},
    {
      c: { lines: [{ text: "a" }, { text: "Hello World" }, { text: "b" }] },
      // white-space.test.tsx has 114.14, the sum of Skia's advances.
      b: { x: 114.13 },
    },
  ),
  between(
    "removes the spaces at the start and end of a run",
    [
      <span key="a">a</span>,
      "  Hello  ",
      <span key="b" id="b">
        b
      </span>,
    ],
    {},
    {
      c: { lines: [{ text: "a" }, { text: "Hello", x: 11.13 }, { text: "b" }] },
      b: { x: 56.7 },
    },
  ),
  between(
    "sizes a run with forced breaks to its widest line",
    [
      <span key="x">x</span>,
      "a\nb",
      <span key="y" id="y">
        y
      </span>,
    ],
    { whiteSpace: "pre-line" },
    {
      c: {
        lines: [
          { text: "x" },
          { text: "a", x: 10 },
          { text: "b" },
          { text: "y" },
        ],
      },
      y: { x: 21.13 },
    },
  ),
  ...(
    [
      ["  ", {}],
      ["", {}],
      ["\n", { whiteSpace: "pre-line" }],
      ["\n", { whiteSpace: "pre" }],
      ["  ", { whiteSpace: "pre" }],
      [" ", { whiteSpace: "pre-wrap" }],
      ["  ", { lineHeight: "30px" }],
      ["\f", {}],
      ["\v", {}],
    ] as const
  ).map(([text, style]) =>
    alone(
      `has no line box for ${quote(text)} in ${JSON.stringify(style)}`,
      text,
      style,
      { width: 0, height: 0, lines: [] },
    ),
  ),
  ...[" ", " "].map((text) =>
    alone(
      `has a line box for ${quote(text)}`,
      text,
      {},
      {
        height: 23,
      },
    ),
  ),

  // Separators and control characters.
  ...ALL.flatMap((whiteSpace) =>
    [" ", " "].flatMap((separator) => {
      const wraps = whiteSpace !== "nowrap" && whiteSpace !== "pre";
      const at = (text: string) => text.replace("|", separator);
      const name = `${quote(separator)} under ${whiteSpace}`;
      return [
        lines(
          `sets a separator as a space: a|b, ${name}`,
          at("a|b"),
          whiteSpace,
          null,
          [272.19],
        ),
        lines(
          `sets a separator as a space: a | b, ${name}`,
          at("a | b"),
          whiteSpace,
          null,
          [261.08],
        ),
        lines(
          `sets a separator as a space: a|, ${name}`,
          at("a|"),
          whiteSpace,
          null,
          [283.31],
        ),
        lines(
          `breaks after a separator: aaaa|bbbb, ${name}`,
          at("aaaa|bbbb"),
          whiteSpace,
          null,
          wraps ? [9.94, 15.5] : [0],
          60,
        ),
      ];
    }),
  ),
  ...ALL.flatMap((whiteSpace) =>
    ["a b", "a b", "a b"].map((text) =>
      paragraph(
        `puts letter spacing after a separator once: ${quote(text)} under ${whiteSpace}`,
        text,
        { whiteSpace, letterSpacing: 5 },
        300,
      ),
    ),
  ),
  ...ALL.flatMap((whiteSpace) =>
    ["\f", "\v"].map((control) => ({
      ...lines(
        `doesn't break at ${quote(control)} under ${whiteSpace}`,
        `aaaa${control}bbbb`,
        whiteSpace,
        ["aaaabbbb"],
        [null],
        60,
      ),
      // Chrome draws a form feed as nothing only under pre and pre-wrap.
      ...((control === "\v" ||
        (whiteSpace !== "pre" && whiteSpace !== "pre-wrap")) && {
        knownDifference: {
          why: intentional(
            "effing-skia#36",
            "Chrome draws it as a box 6.67px wide, from a fallback font that makes the line 30px tall; canvas draws nothing",
          ),
          differs: ["#p height", "#p line 1 top", "#p line 1 width"],
        },
      }),
    })),
  ),
  ...(["pre", "pre-wrap"] as const).flatMap((whiteSpace) => [
    lines(
      `draws a form feed as nothing under ${whiteSpace}`,
      "a\fb",
      whiteSpace,
      null,
      [277.75],
    ),
    lines(
      `draws a form feed between spaces as nothing under ${whiteSpace}`,
      "a \f b",
      whiteSpace,
      null,
      [266.63],
    ),
  ]),
];

export default fixtureModule("white-space", fixtures);
