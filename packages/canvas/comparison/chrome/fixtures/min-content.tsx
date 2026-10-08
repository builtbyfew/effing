import type React from "react";
import { fixtureModule, SANS } from "../fixture.ts";
import type { ChromeFixture, Transcribed } from "../fixture.ts";

// The cases of min-content.test.tsx that hold Chrome's numbers: 40px bold
// Liberation Sans in a 300px flex box at x = 150 of a 600px frame, which
// centres its children unless a case says otherwise.

const NOWRAP = "BMW Serie X X5 M Sportpakket";
const WORD = "Supercalifragilisticexpialidocious";
const WORDS = "Supercalifragilisticexpialidocious Antidisestablishmentarianism";

const inBox = (children: React.ReactNode, box: React.CSSProperties = {}) => (
  <div style={{ display: "flex", width: 600, height: 120 }}>
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: 150,
        top: 0,
        width: 300,
        height: 120,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 40,
        ...box,
      }}
    >
      {children}
    </div>
  </div>
);

const text = (style: React.CSSProperties, content = NOWRAP) => (
  <div key="text" id="text" style={style}>
    {content}
  </div>
);

/** An element's left edge and width, and its lines' left edges. */
const box = (x: number, width: number, lines?: number[]) => ({
  x,
  width,
  ...(lines && { lines: lines.map((left) => ({ x: left })) }),
});

const inBoxFixture = (
  name: string,
  children: React.ReactNode,
  boxStyle: React.CSSProperties,
  transcribed?: Transcribed,
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width: 600,
  height: 120,
  element: inBox(children, boxStyle),
  transcribed,
  ...rest,
});

/** A flex row of Liberation Sans items in a 500px frame (`layOutRow`). */
const row = (
  boxStyle: React.CSSProperties,
  items: [React.CSSProperties, string][],
  spacer?: number,
) => (
  <div style={{ display: "flex", width: 500, height: 120 }}>
    {spacer !== undefined && <div style={{ width: spacer }} />}
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        fontFamily: SANS,
        fontWeight: 400,
        ...boxStyle,
      }}
    >
      {items.map(([style, content], i) => (
        <div key={i} id={`item${i}`} style={style}>
          {content}
        </div>
      ))}
    </div>
  </div>
);

const rowFixture = (
  name: string,
  element: React.ReactElement,
  edges: [number, number][],
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width: 500,
  height: 120,
  element,
  transcribed: Object.fromEntries(
    edges.map(([x, width], i) => [`item${i}`, { x, width }]),
  ),
  ...rest,
});

const SIBLING = (
  <div key="s" style={{ width: 100, height: 20, flexShrink: 0 }} />
);

export default fixtureModule("min-content", [
  ...(
    [
      ["nowrap, centred", { whiteSpace: "nowrap", textAlign: "center" }],
      ["nowrap", { whiteSpace: "nowrap" }],
      [
        "nowrap in a centring row",
        { whiteSpace: "nowrap", textAlign: "center", justifyContent: "center" },
      ],
      ["nowrap that doesn't shrink", { whiteSpace: "nowrap", flexShrink: 0 }],
      ["nowrap, clipped", { whiteSpace: "nowrap", overflow: "clip" }],
    ] as [string, React.CSSProperties][]
  ).map(([name, style]) =>
    inBoxFixture(
      `centred in its parent: ${name}`,
      text(style),
      {},
      {
        text: box(3.27, 593.48, [3.27]),
      },
    ),
  ),
  inBoxFixture(
    "centres a word wider than the box",
    text({ textAlign: "center" }, WORD),
    {},
    { text: box(-17.88, 635.77, [-17.88]) },
  ),
  inBoxFixture(
    "centres words wider than the box, as wide as the widest",
    text({ textAlign: "center" }, WORDS),
    {},
    { text: box(-17.88, 635.77, [-17.88, 15.48]) },
  ),
  inBoxFixture(
    "doesn't count a break-word break in the min-content",
    text({ textAlign: "center", overflowWrap: "break-word" }, WORD),
    {},
    { text: { ...box(-17.88, 635.77, [-17.88]), lines: [{ text: WORD }] } },
  ),
  inBoxFixture(
    "keeps preserved spaces in the min-content",
    text({ whiteSpace: "pre" }, "BMW Serie X  X5 M Sportpakket"),
    {},
    { text: box(-2.3, 604.59, [-2.3]) },
  ),
  inBoxFixture(
    "adds padding and borders",
    text({
      whiteSpace: "nowrap",
      paddingLeft: 20,
      paddingRight: 10,
      borderLeftWidth: 4,
      borderRightWidth: 2,
      borderStyle: "solid",
      borderColor: "red",
    }),
    {},
    { text: box(-14.73, 629.48, [9.27]) },
  ),
  inBoxFixture(
    "centres in a reversed row",
    text({ whiteSpace: "nowrap" }),
    { flexDirection: "row-reverse" },
    { text: box(3.27, 593.48, [3.27]) },
  ),
  inBoxFixture(
    "centres when its parent hides what overflows it",
    text({ whiteSpace: "nowrap" }),
    { overflow: "hidden" },
    { text: box(3.27, 593.48, [3.27]) },
  ),
  inBoxFixture(
    "centres across a column, as wide as its line",
    text({ whiteSpace: "nowrap" }),
    { flexDirection: "column" },
    { text: box(3.27, 593.48, [3.27]) },
  ),
  inBoxFixture(
    "centres across a column, words as wide as the widest",
    text({ textAlign: "center" }, WORDS),
    { flexDirection: "column" },
    { text: box(-17.88, 635.77, [-17.88, 15.48]) },
  ),
  inBoxFixture(
    "keeps the text as wide as its line in a box of its own column",
    text({
      whiteSpace: "nowrap",
      flexDirection: "column",
      alignItems: "center",
    }),
    {},
    { text: box(3.27, 593.48, [3.27]) },
  ),
  inBoxFixture(
    "grows from no flex basis no narrower than its line",
    text({ whiteSpace: "nowrap", flex: 1 }),
    { justifyContent: "flex-start" },
    { text: box(150, 593.48, [150]) },
  ),
  inBoxFixture(
    "sizes an absolutely positioned box to its line",
    text({ whiteSpace: "nowrap", position: "absolute", left: 0, top: 0 }),
    {},
    { text: box(150, 593.48, [150]) },
  ),
  inBoxFixture(
    "keeps a run of text next to an element as wide as its line",
    <div
      id="text"
      style={{
        whiteSpace: "nowrap",
        justifyContent: "center",
        alignItems: "center",
        width: 300,
        height: 120,
      }}
    >
      {NOWRAP}
      <span>!</span>
    </div>,
    {},
    // The run, then the "!".
    { text: { x: 150, width: 300, lines: [{ x: -3.41 }, { text: "!" }] } },
  ),
  inBoxFixture(
    "lets text that can't wrap overflow a row of them",
    [
      <div key="a" id="a" style={{ fontSize: 20, whiteSpace: "nowrap" }}>
        Hello wonderful world
      </div>,
      <div key="b" id="b" style={{ fontSize: 20, whiteSpace: "nowrap" }}>
        Another item
      </div>,
    ],
    { justifyContent: "flex-start", alignItems: "flex-start" },
    { a: box(150, 208.89, [150]), b: box(358.89, 123.34, [358.89]) },
  ),
  inBoxFixture(
    "wraps text that can't wrap to lines of its own in a wrapping row",
    [
      <div key="a" id="a" style={{ fontSize: 30, whiteSpace: "nowrap" }}>
        Hello wonderful world
      </div>,
      <div key="b" id="b" style={{ fontSize: 30, whiteSpace: "nowrap" }}>
        Another item
      </div>,
    ],
    { flexWrap: "wrap", alignItems: "flex-start", alignContent: "flex-start" },
    { a: box(143.33, 313.34, [143.33]), b: box(207.48, 185.02, [207.48]) },
  ),
  inBoxFixture(
    "keeps wrapping text next to a sibling as wide as its widest word",
    [text({ fontSize: 30 }, `Hi ${WORD}`), SIBLING],
    { justifyContent: "flex-start", alignItems: "flex-start" },
    { text: box(150, 476.81, [150, 150]) },
  ),
  ...(
    [
      ["that hides what overflows it", { overflow: "hidden" }, [150]],
      ["with a min-width of its own", { minWidth: 0 }, [150]],
      [
        "that hides what overflows it, centring its text",
        { overflow: "hidden", justifyContent: "center" },
        [3.27],
      ],
    ] as [string, React.CSSProperties, number[]][]
  ).map(([name, style, lines]) =>
    inBoxFixture(
      `shrinks text below its line ${name}`,
      text({ whiteSpace: "nowrap", ...style }),
      {},
      { text: box(150, 300, lines) },
    ),
  ),
  ...(
    [
      ["a width", { width: 200 }, 200, 200],
      [
        "a width wider than the box",
        { width: 400, textAlign: "center" },
        100,
        400,
      ],
      ["a max width", { maxWidth: 250 }, 175, 250],
      ["a max width wider than the box", { maxWidth: 400 }, 100, 400],
      ["a percentage width", { width: "50%" }, 225, 150],
      ["a percentage max width", { maxWidth: "80%" }, 180, 240],
    ] as [string, React.CSSProperties, number, number][]
  ).map(([name, style, x, width]) =>
    inBoxFixture(
      `shrinks text below its line to ${name}`,
      text({ whiteSpace: "nowrap", ...style }),
      {},
      { text: box(x, width, [x]) },
    ),
  ),
  inBoxFixture(
    "shrinks text stretched across a column",
    text({ whiteSpace: "nowrap" }),
    { flexDirection: "column", alignItems: "stretch" },
    { text: box(150, 300, [150]) },
  ),
  inBoxFixture(
    "shrinks text stretched across a column, a break-word word whole",
    text({ overflowWrap: "break-word" }, WORD),
    { flexDirection: "column", alignItems: "stretch" },
    { text: { ...box(150, 300, [150]), lines: [{ text: WORD }] } },
  ),
  ...(
    [
      ["overflow-wrap: anywhere", { overflowWrap: "anywhere" }],
      ["word-break: break-all", { wordBreak: "break-all" }],
      ["word-break: break-word", { wordBreak: "break-word" }],
    ] as [string, React.CSSProperties][]
  ).map(([name, style]) =>
    inBoxFixture(
      `breaks a word anywhere under ${name}`,
      text({ textAlign: "center", ...style }, WORD),
      {},
      { text: box(150, 300, [155.5, 162.16, 264.44]) },
    ),
  ),
  inBoxFixture(
    "truncates text with an ellipsis",
    text({
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden",
    }),
    {},
    { text: box(150, 300, [150]) },
    { screenshot: true },
  ),
  inBoxFixture(
    "clamps its lines",
    text({ lineClamp: 2, overflow: "hidden" }, `${WORD} and more words here`),
    {},
    { text: { x: 150, width: 300, lines: [{ x: 150 }, {}] } },
    { screenshot: true },
  ),
  inBoxFixture(
    "centres a word that fits",
    text({ textAlign: "center" }, "Hello"),
    {},
    { text: box(251.09, 97.8, [251.09]) },
  ),
  inBoxFixture(
    "wraps text that fits next to a sibling",
    [text({ fontSize: 20 }, "Hello wonderful world of flex layout"), SIBLING],
    { justifyContent: "flex-start", alignItems: "flex-start" },
    { text: box(150, 200, [150, 150]) },
  ),
  inBoxFixture(
    "shrinks two runs of text that wrap side by side",
    [
      <div key="a" id="a" style={{ fontSize: 20 }}>
        Hello wonderful world
      </div>,
      <div key="b" id="b" style={{ fontSize: 20 }}>
        Another item that wraps
      </div>,
    ],
    { justifyContent: "flex-start", alignItems: "flex-start" },
    {
      a: box(150, 143.14, [150, 150, 150]),
      b: box(293.14, 156.86, [293.14, 293.14]),
    },
  ),

  // Rows of items held at their minimums, with lengths off Chrome's grid of
  // 1/64px.
  rowFixture(
    "holds items with fractional padding",
    row({ width: 300 }, [
      [
        { fontSize: 20, whiteSpace: "nowrap", paddingLeft: 3.3 },
        "Hello wonderful world",
      ],
      [{ fontSize: 20, whiteSpace: "nowrap" }, "Another item"],
    ]),
    [
      [0, 194.5],
      [194.5, 113.39],
    ],
  ),
  rowFixture(
    "holds items capped at a percentage width",
    row({ width: 300 }, [
      [
        { fontSize: 20, fontWeight: 700, whiteSpace: "nowrap", width: "60%" },
        "Hello wonderful world",
      ],
      [
        { fontSize: 20, fontWeight: 700, whiteSpace: "nowrap", width: "60%" },
        "Another item",
      ],
    ]),
    [
      [0, 180],
      [180, 123.34],
    ],
  ),
  rowFixture(
    "holds items with percentage padding",
    row(
      { width: 300, justifyContent: "center" },
      [
        [
          {
            fontSize: 40,
            fontWeight: 700,
            whiteSpace: "nowrap",
            paddingLeft: "10%",
          },
          NOWRAP,
        ],
      ],
      150,
    ),
    [[-11.73, 623.48]],
  ),
  rowFixture(
    "holds items capped at a percentage max width",
    row({ width: 300 }, [
      [
        {
          fontSize: 40,
          fontWeight: 700,
          whiteSpace: "nowrap",
          maxWidth: "80%",
        },
        NOWRAP,
      ],
      [{ width: 100, height: 20, flexShrink: 0 }, ""],
    ]),
    [
      [0, 240],
      [240, 100],
    ],
  ),
  rowFixture(
    "holds items at percentages and fractions",
    row({ width: 183.191, columnGap: 6.542, justifyContent: "center" }, [
      [
        { fontSize: 17, paddingLeft: 3.307, textAlign: "center" },
        "layout world",
      ],
      [
        {
          fontSize: 11,
          whiteSpace: "nowrap",
          paddingLeft: 6.243,
          borderLeftWidth: 2,
          borderStyle: "solid",
          width: "46.094%",
        },
        "layout Hi",
      ],
      [
        {
          fontSize: 19,
          paddingRight: 7.619,
          width: 156.345,
          textAlign: "center",
        },
        "BMW Hi world",
      ],
      [{ fontSize: 14, flex: 1 }, "world world"],
    ]),
    [
      [-11.81, 48.67],
      [43.39, 51.03],
      [100.95, 54.05],
      [161.53, 33.47],
    ],
  ),
  rowFixture(
    "holds items with words wider than the row",
    row({ width: 120.37 }, [
      [{ fontSize: 20, paddingLeft: 3.3 }, "Hi Supercalifragilistic"],
      [
        { fontSize: 20, paddingLeft: "2.7%", paddingRight: 1.9 },
        "wonderful Sportpakket",
      ],
    ]),
    [
      [0, 164.47],
      [164.47, 111.86],
    ],
  ),
  rowFixture(
    "holds items in a row a few pixels wide",
    row({ width: "1.16%" }, [
      [{ fontSize: 33, whiteSpace: "nowrap", paddingLeft: 7.91 }, "item item"],
      [
        {
          fontSize: 37,
          whiteSpace: "nowrap",
          flex: 1,
          paddingLeft: "7.418%",
        },
        "world layout item",
      ],
    ]),
    [
      [0, 141.77],
      [141.77, 278.03],
    ],
  ),
  rowFixture(
    "holds items that shrink by fractions",
    row({ width: 14.626, columnGap: 1.928 }, [
      [
        {
          fontSize: 39,
          paddingLeft: "0.971%",
          paddingRight: 4.052,
          flexShrink: 1.977,
        },
        "a world X5",
      ],
      [
        { fontSize: 12, paddingLeft: "8.805%", paddingRight: 7.338 },
        "wonderful Another",
      ],
      [
        {
          fontSize: 38,
          whiteSpace: "nowrap",
          paddingLeft: 4.283,
          paddingRight: 8.245,
        },
        "a",
      ],
      [
        {
          fontSize: 30,
          whiteSpace: "nowrap",
          paddingLeft: 3.394,
          borderLeftWidth: 3,
          borderStyle: "solid",
          marginLeft: 1.357,
          width: 168.697,
        },
        "Hi item Sportpakket Supercalifragilistic",
      ],
    ]),
    [
      [0, 97.39],
      [99.31, 60.64],
      [161.88, 33.66],
      [198.8, 168.69],
    ],
    {
      knownDifference: {
        why: "effing#194: canvas makes the first two items one line tall (44px and 14px), where it draws their text, and Chrome lays it out, on three and two lines (132px and 28px)",
        differs: ["#item0 height", "#item1 height"],
      },
    },
  ),
  // Chrome takes the element's flex basis from its text's max-content, where
  // Yoga takes it at the width available, and so shrinks it to another
  // width: min-content.test.tsx holds canvas's widths, and these Chrome's.
  ...(
    [
      ["hides what overflows it", { overflow: "hidden" }, 280, 167.86],
      ["has no min width", { minWidth: 0 }, 280, 167.86],
      [
        "hides what overflows it, next to more",
        { overflow: "hidden" },
        290,
        165.27,
      ],
      ["has no min width, next to more", { minWidth: 0 }, 290, 165.27],
    ] as [string, React.CSSProperties, number, number][]
  ).map(([name, style, sibling, width]) =>
    rowFixture(
      `shrinks an element that ${name} by its flex basis`,
      row({ width: 300 }, [
        [
          { fontSize: 20, ...style },
          "Supercalifragilistic and more words here",
        ],
        [{ width: sibling, height: 10, flexShrink: 1 }, ""],
      ]),
      [
        [0, width],
        [width, 300 - width],
      ],
      {
        knownDifference: {
          why: "effing#195: Yoga shares the shrinking out by the flex basis at the width available, where Chrome takes the text's max-content",
          differs: ["#item0 width", "#item1 x", "#item1 width"],
        },
      },
    ),
  ),
  {
    name: "leaves a wide item that doesn't shrink as wide as it is",
    width: 500,
    height: 300,
    element: (
      <div style={{ display: "flex", flexDirection: "column", width: 500 }}>
        <div style={{ display: "flex", width: 500 }}>
          <div
            id="strip"
            style={{ width: 70_000, height: 10, flexShrink: 0 }}
          />
        </div>
        <div
          style={{
            display: "flex",
            width: 300,
            justifyContent: "center",
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          <div id="text" style={{ whiteSpace: "nowrap" }}>
            {NOWRAP}
          </div>
        </div>
      </div>
    ),
    transcribed: {
      strip: { x: 0, width: 70_000 },
      text: { x: -146.73, width: 593.48 },
    },
  },
]);
