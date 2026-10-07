import React from "react";
import { fixtureModule, quote } from "../fixture.ts";
import type { ChromeFixture, Transcribed } from "../fixture.ts";

// Cases of br.test.tsx that hold Chrome's numbers: 20px Liberation Sans
// (23px lines) in a 300px flex container (`id="c"`) with `align-items:
// flex-start`, as tall as its content.

type Expected = Transcribed["c"];

const container = (
  name: string,
  children: React.ReactNode,
  style: React.CSSProperties = {},
  transcribed?: Expected,
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
        alignSelf: "flex-start",
        width: 300,
        fontFamily: "Liberation Sans",
        fontSize: 20,
        ...style,
      }}
    >
      {children}
    </div>
  ),
  transcribed: transcribed && { c: transcribed },
});

/** Lines of text at (x, top); `null` for an empty line. */
const at = (
  height: number,
  lines: ([string, number, number] | [string, number] | null)[],
): Expected => ({
  height,
  lines: lines.map((line) =>
    line === null
      ? { text: "" }
      : {
          text: line[0],
          ...(line.length === 3
            ? { x: line[1], top: line[2] }
            : { top: line[1] }),
        },
  ),
});

/** Right-aligned in the full 300px, where Chrome stretches the item. */
const rightAligned = (whiteSpace: React.CSSProperties["whiteSpace"]) => ({
  flexDirection: "column" as const,
  alignItems: "stretch" as const,
  textAlign: "right" as const,
  whiteSpace,
});

const fixtures: ChromeFixture[] = [
  container(
    "stacks the text either side of it in a row",
    ["First line ", <br key="1" />, " second line"],
    {},
    at(46, [
      ["First line", 0, 0],
      ["second line", 0, 23],
    ]),
  ),
  container(
    "stacks three lines in a row",
    <>
      First line <br /> second line <br /> third line
    </>,
    {},
    at(69, [
      ["First line", 0, 0],
      ["second line", 0, 23],
      ["third line", 0, 46],
    ]),
  ),
  container(
    "keeps the run as narrow as its lines next to other elements",
    [
      <span key="x">x</span>,
      "a",
      <br key="1" />,
      "b",
      <span key="y">y</span>,
      "c",
      <br key="2" />,
      "d",
    ],
    {},
    at(46, [
      ["x", 0, 0],
      ["a", 10, 0],
      ["b", 10, 23],
      ["y", 21.13, 0],
      ["c", 31.13, 0],
      ["d", 31.13, 23],
    ]),
  ),
  container(
    "makes a <br> between elements an empty line of its own in a row",
    [
      <span key="a">a</span>,
      <br key="1" />,
      <span key="b" id="b">
        b
      </span>,
    ],
    {},
    {
      height: 23,
      lines: [{ text: "a" }, { text: "", x: 11.13 }, { text: "b" }],
    },
  ),
  container(
    "starts the run after an element with a <br>",
    [<span key="x">x</span>, <br key="1" />, "a"],
    {},
    at(46, [["x", 0, 0], null, ["a", 10, 23]]),
  ),
  container(
    "ends the run before an element with a <br>",
    ["a", <br key="1" />, <span key="x">x</span>],
    {},
    at(23, [
      ["a", 0, 0],
      ["x", 11.13, 0],
    ]),
  ),
  container(
    "breaks the text of an element with a <br> in it",
    [
      <span key="a">
        a<br />b
      </span>,
      <span key="c">c</span>,
    ],
    {},
    at(46, [
      ["a", 0, 0],
      ["b", 0, 23],
      ["c", 11.13, 0],
    ]),
  ),
  container(
    "stacks the text either side of it in a column",
    ["First line ", <br key="1" />, " second line"],
    { flexDirection: "column" },
    at(46, [
      ["First line", 0, 0],
      ["second line", 0, 23],
    ]),
  ),
  ...["", " "].map((space) =>
    container(
      `makes a <br> between elements an empty line of its own in a column (${quote(space)})`,
      [
        <span key="a">a</span>,
        space,
        <br key="1" />,
        space,
        <span key="b">b</span>,
      ],
      { flexDirection: "column" },
      at(69, [["a", 0, 0], null, ["b", 0, 46]]),
    ),
  ),
  container(
    "breaks the runs between elements in a column",
    [
      <span key="x">x</span>,
      "a",
      <br key="1" />,
      "b",
      <span key="y">y</span>,
      "c",
      <br key="2" />,
      "d",
    ],
    { flexDirection: "column" },
    at(138, [
      ["x", 0],
      ["a", 23],
      ["b", 46],
      ["y", 69],
      ["c", 92],
      ["d", 115],
    ]),
  ),
  ...(
    [
      [
        "a <br> at the start",
        [<br key="1" />, "First"],
        at(46, [null, ["First", 23]]),
      ],
      ["a <br> at the end", ["First", <br key="1" />], at(23, [["First", 0]])],
      [
        "two <br>s at the end",
        ["First", <br key="1" />, <br key="2" />],
        at(46, [["First", 0], null]),
      ],
      [
        "two <br>s",
        ["a", <br key="1" />, <br key="2" />, "b"],
        at(69, [["a", 0], null, ["b", 46]]),
      ],
      [
        "three <br>s",
        ["a", <br key="1" />, <br key="2" />, <br key="3" />, "b"],
        at(92, [["a", 0], null, null, ["b", 69]]),
      ],
      [
        "two <br>s at the start",
        [<br key="1" />, <br key="2" />, "a"],
        at(69, [null, null, ["a", 46]]),
      ],
      ["nothing but a <br>", [<br key="1" />], at(23, [null])],
      [
        "nothing but two <br>s",
        [<br key="1" />, <br key="2" />],
        at(46, [null, null]),
      ],
      ["a <br> in white space", [" ", <br key="1" />, " "], at(23, [null])],
    ] as [string, React.ReactNode, Expected][]
  ).flatMap(([name, children, expected]) =>
    (["row", "column"] as const).map((flexDirection) =>
      container(
        `lays out ${name} in a ${flexDirection}`,
        children,
        { flexDirection },
        expected,
      ),
    ),
  ),
  container(
    "ignores a <br> with display: none",
    ["First line ", <br key="1" style={{ display: "none" }} />, " second line"],
    {},
    {
      height: 23,
      lines: [{ text: "First line second line", x: 0, width: 182.31 }],
    },
  ),
  ...(["normal", "nowrap", "pre-line"] as const).flatMap((whiteSpace) => [
    container(
      `removes the spaces around a <br> under ${whiteSpace}`,
      ["a ", <br key="1" />, " b"],
      rightAligned(whiteSpace),
      at(46, [
        ["a", 288.88, 0],
        ["b", 288.88, 23],
      ]),
    ),
    container(
      `removes tabs and newlines around a <br> under ${whiteSpace}`,
      ["a \t\n ", <br key="1" />, " \t\n b"],
      rightAligned(whiteSpace),
      whiteSpace === "pre-line"
        ? { height: 92 }
        : at(46, [
            ["a", 288.88, 0],
            ["b", 288.88, 23],
          ]),
    ),
  ]),
  ...(["pre", "pre-wrap"] as const).map((whiteSpace) =>
    container(
      `keeps the spaces around a <br> under ${whiteSpace}`,
      ["a ", <br key="1" />, " b"],
      rightAligned(whiteSpace),
      at(46, [
        ["a ", 283.31, 0],
        [" b", 283.31, 23],
      ]),
    ),
  ),
  ...(["pre-line", "pre", "pre-wrap"] as const).flatMap((whiteSpace) =>
    [
      ["a\n", <br key="1" />, "b"],
      ["a", <br key="1" />, "\nb"],
    ].map((children, i) =>
      container(
        `breaks at both a newline and a <br> under ${whiteSpace} (${i + 1})`,
        children,
        { whiteSpace },
        at(69, [["a", 0, 0], null, ["b", 0, 46]]),
      ),
    ),
  ),
  ...(["pre", "pre-wrap"] as const).map((whiteSpace) =>
    container(
      `lays a CR before a <br> out under ${whiteSpace}`,
      ["A\rV\r", <br key="1" />, "b"],
      rightAligned(whiteSpace),
      at(46, [
        ["A\rV", 273.31, 0],
        ["b", 288.88, 23],
      ]),
    ),
  ),
  container(
    "keeps a line separator before a <br> a space",
    ["a ", <br key="1" />, "b"],
    rightAligned("normal"),
    {
      lines: [
        { x: 283.31, top: 0 },
        { x: 288.88, top: 23 },
      ],
    },
  ),
  container(
    "keeps the no-break spaces around a <br>",
    ["a ", <br key="1" />, " b"],
    rightAligned("normal"),
    at(46, [
      ["a ", 283.31, 0],
      [" b", 283.31, 23],
    ]),
  ),
  container(
    "breaks at a <br> under nowrap",
    [
      "Hello world again and more ",
      <br key="1" />,
      " words here and some more",
    ],
    { whiteSpace: "nowrap" },
    at(46, [
      ["Hello world again and more", 0, 0],
      ["words here and some more", 0, 23],
    ]),
  ),
  container(
    "wraps the lines between <br>s",
    ["Hello world again and more words here ", <br key="1" />, " next"],
    { width: 150 },
    at(92, [
      ["Hello world", 0],
      ["again and more", 23],
      ["words here", 46],
      ["next", 69],
    ]),
  ),
  ...(
    [
      ["right", [224.42, 198.81, 224.39]],
      ["center", [112.2, 99.41, 112.19]],
    ] as const
  ).map(([textAlign, x]) =>
    container(
      `aligns each line ${textAlign}`,
      <>
        First line <br /> second line <br /> third line
      </>,
      { flexDirection: "column", alignItems: "stretch", textAlign },
      { lines: x.map((left) => ({ x: left })) },
    ),
  ),
  container(
    "aligns the lines of a wrapped line",
    ["aaa bbb ", <br key="1" />, " ccc"],
    {
      flexDirection: "column",
      alignItems: "stretch",
      textAlign: "right",
      width: 60,
    },
    at(69, [
      ["aaa", 26.63, 0],
      ["bbb", 26.63, 23],
      ["ccc", 30, 46],
    ]),
  ),
  ...(
    [
      [
        "<br>s",
        [
          "Short",
          <br key="1" />,
          "A longer line here",
          <br key="2" />,
          "Mid one",
        ],
        "normal",
      ],
      ["newlines", ["Short\nA longer line here\nMid one"], "pre-line"],
    ] as const
  )
    .map(([name, children, whiteSpace]) =>
      container(
        `sizes clamped lines with ${name} to the widest`,
        <div id="clamped" style={{ lineClamp: 2, whiteSpace }}>
          {children}
        </div>,
        { flexDirection: "column" },
        undefined,
      ),
    )
    .map((fixture) => ({
      ...fixture,
      transcribed: {
        clamped: { width: 155.67, lines: [{ text: "Short" }, {}] },
      },
    })),
];

export default fixtureModule("br", fixtures);
