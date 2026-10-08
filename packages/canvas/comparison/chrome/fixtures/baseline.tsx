import type React from "react";
import { SANS, fixtureModule } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";

// `alignItems: "baseline"` and `alignSelf: "baseline"`: items in a row
// aligned by their first lines' baselines, as text of other sizes, line
// heights, padding and nesting move them. 20px Liberation Sans unless a case
// says otherwise.

/** Items in a row (`id="row"`) that aligns them by their baselines. */
const row = (
  name: string,
  children: React.ReactNode,
  style: React.CSSProperties = {},
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width: 400,
  height: 200,
  element: (
    <div
      id="row"
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: SANS,
        fontSize: 20,
        ...style,
      }}
    >
      {children}
    </div>
  ),
  ...rest,
});

const fixtures: ChromeFixture[] = [
  row("aligns text of mixed font sizes", [
    <div key="a" id="big" style={{ fontSize: 48 }}>
      Big
    </div>,
    <div key="b" id="medium" style={{ fontSize: 24 }}>
      medium
    </div>,
    <div key="c" id="small" style={{ fontSize: 12 }}>
      small
    </div>,
  ]),
  row(
    "aligns a price with its currency and unit",
    [
      <div key="a" id="currency" style={{ fontSize: 24 }}>
        €
      </div>,
      <div key="b" id="amount" style={{ fontSize: 64, fontWeight: 700 }}>
        42
      </div>,
      <div key="c" id="unit" style={{ fontSize: 16, color: "#666" }}>
        /month
      </div>,
    ],
    { gap: 4, padding: 10, backgroundColor: "white" },
    { width: 220, height: 100, screenshot: true },
  ),
  row(
    "aligns a badge with a price, in rows of set line heights",
    [
      <div
        key="a"
        id="badge"
        style={{
          fontSize: 11,
          lineHeight: "11px",
          fontWeight: 700,
          color: "white",
          backgroundColor: "#16A34A",
          borderRadius: 4,
          padding: "2px 8px",
          letterSpacing: 2,
        }}
      >
        NEW
      </div>,
      <div
        key="b"
        id="price"
        style={{ fontSize: 24, lineHeight: "24px", fontWeight: 700 }}
      >
        $425,000
      </div>,
    ],
    {
      justifyContent: "space-between",
      width: 260,
      padding: 10,
      backgroundColor: "white",
    },
    { width: 280, height: 60, screenshot: true },
  ),
  row("aligns wrapped text by its first line", [
    <div key="a" id="label" style={{ fontSize: 40 }}>
      Total
    </div>,
    <div key="b" id="wrapped" style={{ width: 120, fontSize: 16 }}>
      a few words that wrap over three lines
    </div>,
  ]),
  row("aligns text with forced breaks by its first line", [
    <div key="a" id="lines" style={{ whiteSpace: "pre-line" }}>
      {"first line\nsecond line"}
    </div>,
    <div key="b" id="small" style={{ fontSize: 12 }}>
      small
    </div>,
  ]),
  row("aligns text by its content box, past padding and borders", [
    <div
      key="a"
      id="padded"
      style={{
        fontSize: 30,
        padding: "12px 4px 6px",
        borderTopWidth: 5,
        borderBottomWidth: 2,
        borderStyle: "solid",
        borderColor: "black",
      }}
    >
      Padded
    </div>,
    <div key="b" id="plain" style={{ fontSize: 14 }}>
      plain
    </div>,
  ]),
  row("aligns text of set line heights", [
    <div key="a" id="tall" style={{ lineHeight: "60px" }}>
      Tall
    </div>,
    <div key="b" id="normal">
      normal
    </div>,
    <div key="c" id="tight" style={{ fontSize: 30, lineHeight: "20px" }}>
      tight
    </div>,
  ]),
  row("aligns trimmed text", [
    <div
      key="a"
      id="trimmed"
      style={{
        fontSize: 40,
        textBoxTrim: "trim-both",
        textBoxEdge: "cap alphabetic",
      }}
    >
      Cap
    </div>,
    <div key="b" id="other" style={{ fontSize: 16 }}>
      text
    </div>,
  ]),
  row("aligns runs of text among elements", [
    "Total ",
    <span key="a" id="amount" style={{ fontSize: 36 }}>
      99
    </span>,
    " due",
  ]),
  row("aligns a box of a nested column by its first item", [
    <div key="a" id="card" style={{ flexDirection: "column", paddingTop: 8 }}>
      <div id="title" style={{ fontSize: 32 }}>
        Title
      </div>
      <div id="subtitle" style={{ fontSize: 12 }}>
        subtitle
      </div>
    </div>,
    <div key="b" id="side" style={{ fontSize: 16 }}>
      side
    </div>,
  ]),
  row("aligns a box of a nested baseline row by its shared baseline", [
    <div key="a" id="inner" style={{ alignItems: "baseline", paddingTop: 4 }}>
      <div id="x" style={{ fontSize: 12 }}>
        x
      </div>
      <div id="y" style={{ fontSize: 36 }}>
        Y
      </div>
    </div>,
    <div key="b" id="z" style={{ fontSize: 20 }}>
      z
    </div>,
  ]),
  row("aligns an empty box by its bottom edge", [
    <div key="a" id="box" style={{ width: 20, height: 30 }} />,
    <div key="b" id="text" style={{ fontSize: 30 }}>
      text
    </div>,
  ]),
  row("aligns items by their baselines below their top margins", [
    <div key="a" id="low" style={{ marginTop: 30, marginBottom: 6 }}>
      low
    </div>,
    <div key="b" id="big" style={{ fontSize: 40 }}>
      Big
    </div>,
    <div key="c" id="auto" style={{ marginTop: "auto", fontSize: 12 }}>
      auto
    </div>,
  ]),
  row(
    "aligns only the items with alignSelf: baseline",
    [
      <div key="a" id="big" style={{ fontSize: 40, alignSelf: "baseline" }}>
        Big
      </div>,
      <div key="b" id="small" style={{ fontSize: 14, alignSelf: "baseline" }}>
        small
      </div>,
      <div key="c" id="top" style={{ fontSize: 14 }}>
        top
      </div>,
    ],
    { alignItems: "flex-start" },
  ),
  row(
    "aligns each line of a wrapping row",
    [
      <div key="a" id="a" style={{ fontSize: 40 }}>
        One
      </div>,
      <div key="b" id="b" style={{ fontSize: 14 }}>
        two
      </div>,
      <div key="c" id="c" style={{ fontSize: 14 }}>
        three
      </div>,
      <div key="d" id="d" style={{ fontSize: 32 }}>
        Four
      </div>,
    ],
    { flexWrap: "wrap", alignSelf: "flex-start", width: 150, columnGap: 6 },
  ),
];

export default fixtureModule("baseline", fixtures);
