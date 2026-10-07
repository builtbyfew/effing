import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import type { ComputedStyle } from "../src/jsx/style/compute.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { buildLayoutTree } from "../src/jsx/layout.ts";
import type { LayoutNode } from "../src/jsx/layout.ts";
import { layoutText } from "../src/jsx/text/index.ts";
import { loadFonts } from "./_helpers/setup.ts";

// White space processing as CSS Text 3 §4.1 has it (#173). The expectations
// are Chrome's, for 20px Liberation Sans in a 300px box: the lines, and where
// a right-aligned line starts.
describe("white space", () => {
  beforeAll(async () => {
    ensureFontsRegistered(await loadFonts());
  });

  type WhiteSpace = NonNullable<ComputedStyle["whiteSpace"]>;

  const style = (s: Partial<ComputedStyle>) =>
    ({
      fontFamily: "Liberation Sans",
      fontSize: 20,
      color: "black",
      ...s,
    }) as ComputedStyle;

  /** The lines of `text`, and where each starts when right-aligned. */
  function lines(
    text: string,
    whiteSpace: WhiteSpace,
    width = 300,
    s: Partial<ComputedStyle> = {},
  ) {
    const result = layoutText(
      text,
      style({ whiteSpace, textAlign: "right", ...s }),
      width,
    );
    return {
      text: result.segments.map((seg) => seg.text),
      x: result.segments.map((seg) => seg.x),
    };
  }

  const COLLAPSING = ["normal", "nowrap", "pre-line"] as const;

  it.each([
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
    ["a\n\n\nb", "pre-line", ["a", "", "", "b"], [288.88, null, null, 288.88]],
    ["Hello \n ", "pre-line", ["Hello"], [254.42]],
  ] as const)(
    "breaks %j under white-space: %s as Chrome does",
    (text, whiteSpace, expectedLines, x) => {
      const result = lines(text, whiteSpace);
      expect(result.text).toEqual(expectedLines);
      result.x.forEach((value, i) => {
        // An empty line has nothing to place.
        if (x[i] !== null) expect(value).toBeCloseTo(x[i]!, 1);
      });
    },
  );

  it.each(COLLAPSING)("collapses spaces and tabs under %s", (whiteSpace) => {
    expect(lines("a\tb\t\tc", whiteSpace)).toEqual({
      text: ["a b c"],
      x: [expect.closeTo(256.64, 1)],
    });
    expect(lines("a     b", whiteSpace)).toEqual({
      text: ["a b"],
      x: [expect.closeTo(272.19, 1)],
    });
    // Spaces at the start and end of a line are removed, not just hung.
    expect(lines("   Hello world   ", whiteSpace)).toEqual({
      text: ["Hello world"],
      x: [expect.closeTo(201.06, 1)],
    });
    // A no-break space doesn't collapse.
    expect(lines("a\u00a0\u00a0 b", whiteSpace)).toEqual({
      text: ["a\u00a0\u00a0 b"],
      x: [expect.closeTo(261.08, 1)],
    });
  });

  it("wraps collapsed text, hanging the space at each wrap", () => {
    const text = "Hello   world   again   and   more   words   here";
    for (const whiteSpace of ["normal", "pre-line"] as const) {
      const result = lines(text, whiteSpace, 150);
      expect(result.text).toEqual([
        "Hello world",
        "again and more",
        "words here",
      ]);
      result.x.forEach((value, i) =>
        expect(value).toBeCloseTo([51.06, 11.02, 51.06][i]!, 1),
      );
    }
    const nowrap = layoutText(text, style({ whiteSpace: "nowrap" }), 150);
    expect(nowrap.segments.map((s) => s.text)).toEqual([
      "Hello world again and more words here",
    ]);
    expect(nowrap.width).toBeCloseTo(347.97, 1);
  });

  it.each(["pre", "pre-wrap"] as const)(
    "keeps spaces, tabs and newlines under %s",
    (whiteSpace) => {
      expect(lines("a  \n  b", whiteSpace)).toEqual({
        text: ["a  ", "  b"],
        x: [expect.closeTo(277.75, 1), expect.closeTo(277.75, 1)],
      });
      expect(lines("a     b", whiteSpace)).toEqual({
        text: ["a     b"],
        x: [expect.closeTo(249.97, 1)],
      });
      expect(lines("   Hello world   ", whiteSpace)).toEqual({
        text: ["   Hello world   "],
        x: [expect.closeTo(167.73, 1)],
      });
    },
  );

  // `pre-wrap` keeps the spaces that start a line: Chrome puts the spaces of
  // "  ab cd" on a line of their own at 30px, where "  ab" doesn't fit, and
  // keeps them before "cd" after a newline. They hang at the soft wrap, so
  // the first line has no text of its own.
  it("keeps the spaces that start a line under pre-wrap", () => {
    expect(
      lines("  ab cd", "pre-wrap", 30, { textAlign: "left" }).text,
    ).toEqual(["", "ab", "cd"]);
    expect(lines("ab\n  cd ef", "pre-wrap")).toEqual({
      text: ["ab", "  cd ef"],
      x: [expect.closeTo(277.75, 1), expect.closeTo(245.52, 1)],
    });
  });

  // Chrome lays a lone CR out with no width and no break opportunity under
  // `pre` and `pre-wrap`, but the letters either side of it don't kern: "AV"
  // is 50.39px in 40px Liberation Sans, "A\rV" 53.38px and "T\ro" 46.69px.
  it.each(["pre", "pre-wrap"] as const)(
    "draws a lone CR as nothing, and breaks the kerning at it, under %s",
    (whiteSpace) => {
      const result = layoutText("a\rb", style({ whiteSpace }), 300);
      expect(result.segments.map((s) => s.text)).toEqual(["a\rb"]);
      expect(result.width).toBeCloseTo(22.25, 1);
      const wrapped = layoutText("aaaa\rbbbb", style({ whiteSpace }), 50);
      expect(wrapped.segments).toHaveLength(1);
      const at40 = (text: string) =>
        layoutText(text, style({ whiteSpace, fontSize: 40 }), 1000).width;
      expect(at40("AV")).toBeCloseTo(50.39, 1);
      expect(at40("A\rV")).toBeCloseTo(53.38, 1);
      expect(at40("T\ro")).toBeCloseTo(46.69, 1);
    },
  );

  // A newline that ends the text ends its last line, rather than starting an
  // empty one; Chrome gives "a\n" one line and "a\n\n" two.
  it.each(["pre-line", "pre", "pre-wrap"] as const)(
    "starts no line after a newline that ends the text under %s",
    (whiteSpace) => {
      expect(lines("Hello\n", whiteSpace).text).toEqual(["Hello"]);
      expect(lines("a\r\n", whiteSpace).text).toEqual(["a"]);
      expect(lines("a\n\n", whiteSpace).text).toEqual(["a", ""]);
    },
  );

  // Chrome turns the newline between two CJK characters into a space too.
  it("turns a newline between CJK characters into a space", () => {
    const joined = layoutText("東京 大阪", style({}), 300);
    const result = layoutText("東京\n大阪", style({}), 300);
    expect(result.segments.map((s) => s.text)).toEqual(["東京 大阪"]);
    expect(result.width).toBeCloseTo(joined.width, 4);
  });

  describe("with line-clamp and text-overflow", () => {
    const text = "Hello   world\n  again and\tmore\r\nwords here";

    it("clamps the collapsed lines, as Chrome does", () => {
      const result = layoutText(text, style({ lineClamp: 2 }), 150);
      expect(result.segments.map((s) => s.text)).toEqual([
        "Hello world",
        "again and mor",
      ]);
    });

    // Chrome puts the ellipsis after a clamped line that ends at a forced
    // break too; the widths are Chrome's for the line with its "…".
    it("clamps pre-line text after a forced break, as Chrome does", () => {
      const result = layoutText(
        text,
        style({ whiteSpace: "pre-line", lineClamp: 2 }),
        150,
      );
      expect(result.segments.map((s) => s.text)).toEqual([
        "Hello world",
        "again and mor",
      ]);
      expect(result.segments[1]!.width).toBeCloseTo(147.88, 1);
    });

    it.each([
      ["ab\ncd", "pre-line", 1, ["ab"], [42.25]],
      ["ab\ncd", "pre-wrap", 1, ["ab"], [42.25]],
      // `pre-wrap` keeps the spaces before the ellipsis.
      ["ab  \ncd", "pre-wrap", 1, ["ab  "], [53.36]],
      // An empty clamped line is the ellipsis alone.
      ["ab\n\ncd", "pre-line", 2, ["ab", ""], [22.25, 20]],
      ["ab\n\ncd", "pre-wrap", 2, ["ab", ""], [22.25, 20]],
      // A CRLF is a newline: the CR isn't drawn before the ellipsis.
      ["ab\r\ncd", "pre-wrap", 1, ["ab"], [42.25]],
      ["ab\r\ncd\r\nef", "pre-wrap", 2, ["ab", "cd"], [22.25, 41.13]],
    ] as const)(
      "ends %j under %s clamped to %s lines in an ellipsis, as Chrome does",
      (text, whiteSpace, lineClamp, expectedLines, widths) => {
        const result = layoutText(text, style({ whiteSpace, lineClamp }), 300);
        expect(result.segments.map((s) => s.text)).toEqual(expectedLines);
        result.segments.forEach((seg, i) =>
          expect(seg.width).toBeCloseTo(widths[i]!, 1),
        );
      },
    );

    it("ends a clamped line with an emoji at a CRLF in an ellipsis", () => {
      const result = layoutText(
        "ab 🎉\r\ncd",
        style({ whiteSpace: "pre-wrap", lineClamp: 1 }),
        300,
        true,
      );
      expect(result.segments.map((s) => s.text)).toEqual(["ab 🎉"]);
      // "ab ", the emoji's 1em box and the ellipsis.
      expect(result.segments[0]!.width).toBeCloseTo(27.81 + 20 + 20, 1);
    });

    // Chrome gives "ab…" under `pre` too.
    it.each(["ab\ncd", "ab\r\ncd"])(
      "puts an ellipsis after a forced break under pre (%j), as Chrome does",
      (text) => {
        const result = layoutText(
          text,
          style({ whiteSpace: "pre", lineClamp: 1 }),
          300,
        );
        expect(result.segments.map((s) => s.text)).toEqual(["ab"]);
        expect(result.segments[0]!.width).toBeCloseTo(42.25, 1);
      },
    );

    it("truncates nowrap text on one line, as Chrome does", () => {
      const result = layoutText(
        text,
        style({ whiteSpace: "nowrap", textOverflow: "ellipsis" }),
        150,
      );
      expect(result.segments.map((s) => s.text)).toEqual(["Hello world ag"]);
      expect(result.height).toBe(23);
    });
  });

  it("collapses before text-transform, as CSS does", () => {
    const result = layoutText(
      "hello \n\t world",
      style({ textTransform: "capitalize" }),
      300,
    );
    expect(result.segments.map((s) => s.text)).toEqual(["Hello World"]);
  });

  it("maps emoji drawn as images across the collapsed text", () => {
    const text = "Hi \n 🌍 \t there";
    const collapsed = layoutText(text, style({}), 300, true);
    expect(collapsed.segments.map((s) => s.text)).toEqual(["Hi 🌍 there"]);
    expect(collapsed.emoji.map((e) => e.grapheme)).toEqual(["🌍"]);
    const hi = layoutText("Hi ", style({ whiteSpace: "pre" }), 300);
    expect(collapsed.emoji[0]!.x).toBeCloseTo(hi.width, 2);

    const preLine = layoutText(
      text,
      style({ whiteSpace: "pre-line" }),
      300,
      true,
    );
    expect(preLine.segments.map((s) => s.text)).toEqual(["Hi", "🌍 there"]);
    expect(preLine.emoji[0]!.x).toBeCloseTo(0, 4);
    expect(preLine.emoji[0]!.baseline).toBe(preLine.segments[1]!.y);
  });

  // Each run of text between elements is a flex item of its own (CSS
  // Flexbox §4), Chrome's positions for which these are.
  describe("between elements", () => {
    async function layOut(
      children: React.ReactNode,
      style: React.CSSProperties,
    ): Promise<LayoutNode> {
      const { tree } = await buildLayoutTree(
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            width: 300,
            fontFamily: "Liberation Sans",
            fontSize: 20,
            ...style,
          }}
        >
          {children}
        </div>,
        400,
        400,
      );
      return tree.children[0]!;
    }

    const describeChildren = (node: LayoutNode) =>
      node.children.map((child) => ({
        type: child.type,
        text: child.textLayout?.segments.map((s) => s.text),
        x: child.x,
        y: child.y,
      }));

    it("doesn't render a run of nothing but white space", async () => {
      for (const ws of ["normal", "pre-line", "pre", "pre-wrap"] as const) {
        for (const space of [" ", "\n   ", "\t", "", "\f", "\v"]) {
          const column = await layOut(
            [<span key="a">a</span>, space, <span key="b">b</span>],
            { flexDirection: "column", whiteSpace: ws },
          );
          expect(describeChildren(column)).toEqual([
            expect.objectContaining({ type: "span", y: 0 }),
            expect.objectContaining({ type: "span", y: 23 }),
          ]);
        }
      }
      const row = await layOut(
        [<span key="a">a</span>, " ", <span key="b">b</span>],
        { gap: 10 },
      );
      expect(row.children).toHaveLength(2);
      expect(row.children[1]!.x).toBeCloseTo(21.13, 0);
    });

    it("renders a run of no-break spaces", async () => {
      const column = await layOut(
        [<span key="a">a</span>, "\u00a0", <span key="b">b</span>],
        { flexDirection: "column" },
      );
      expect(column.children.map((c) => c.y)).toEqual([0, 23, 46]);
    });

    it("lays adjacent text out as one run", async () => {
      const row = await layOut(
        [<span key="a">a</span>, "Hello ", "World", <span key="b">b</span>],
        {},
      );
      expect(describeChildren(row)).toEqual([
        expect.objectContaining({ type: "span", x: 0 }),
        expect.objectContaining({ type: "text", text: ["Hello World"] }),
        expect.objectContaining({ type: "span" }),
      ]);
      expect(row.children[2]!.x).toBeCloseTo(114.14, 0);
    });

    it("removes the spaces at the start and end of a run", async () => {
      const row = await layOut(
        [<span key="a">a</span>, "  Hello  ", <span key="b">b</span>],
        {},
      );
      expect(row.children[1]!.textLayout!.segments[0]!.text).toBe("Hello");
      expect(row.children[1]!.x).toBeCloseTo(11.13, 0);
      expect(row.children[2]!.x).toBeCloseTo(56.7, 0);
    });

    // A <br> is a forced break in the run around it (see br.test.tsx).
    it("removes the spaces around a <br />", async () => {
      for (const flexDirection of ["row", "column"] as const) {
        const node = await layOut(
          [
            "First line ",
            <br key="1" />,
            " second line ",
            <br key="2" />,
            " third line",
          ],
          { flexDirection },
        );
        expect(describeChildren(node)).toEqual([
          {
            type: "text",
            text: ["First line", "second line", "third line"],
            x: 0,
            y: 0,
          },
        ]);
      }
    });

    // Chrome sizes the run to its widest line (fit-content), where it has no
    // soft wrap: "y" follows it at 21.13px.
    it("sizes a run with forced breaks to its widest line", async () => {
      const row = await layOut(
        [<span key="x">x</span>, "a\nb", <span key="y">y</span>],
        { whiteSpace: "pre-line" },
      );
      expect(describeChildren(row)).toEqual([
        expect.objectContaining({ type: "span", x: 0 }),
        expect.objectContaining({ type: "text", text: ["a", "b"], x: 10 }),
        expect.objectContaining({ type: "span" }),
      ]);
      expect(row.children[2]!.x).toBeCloseTo(21.13, 0);
    });

    // The DOM has no fragments or components: their content is the parent's.
    it("merges text across fragments, arrays and components", async () => {
      const World = () => "World";
      const Content = () => [
        "Hello ",
        <React.Fragment key="w">
          <World />
        </React.Fragment>,
      ];
      for (const content of [
        ["Hello ", <React.Fragment key="w">World</React.Fragment>],
        ["Hello ", ["World"]],
        <Content key="c" />,
      ]) {
        const row = await layOut(
          [<span key="a">a</span>, content, <span key="b">b</span>],
          {},
        );
        expect(describeChildren(row)).toEqual([
          expect.objectContaining({ type: "span", x: 0 }),
          expect.objectContaining({ type: "text", text: ["Hello World"] }),
          expect.objectContaining({ type: "span" }),
        ]);
        expect(row.children[2]!.x).toBeCloseTo(114.14, 0);
      }
    });

    it("keeps the elements a component returns in an array", async () => {
      const Pair = () => [<span key="a">a</span>, <span key="b">b</span>];
      const column = await layOut(<Pair />, { flexDirection: "column" });
      expect(describeChildren(column)).toEqual([
        expect.objectContaining({ type: "span", y: 0 }),
        expect.objectContaining({ type: "span", y: 23 }),
      ]);
    });

    it("doesn't render a fragment of nothing but white space", async () => {
      const column = await layOut(
        [
          <span key="a">a</span>,
          <React.Fragment key="f"> </React.Fragment>,
          <span key="b">b</span>,
        ],
        { flexDirection: "column" },
      );
      expect(column.children.map((c) => [c.type, c.y])).toEqual([
        ["span", 0],
        ["span", 23],
      ]);
    });
  });

  // An element is a flex container, and text of nothing but white space in
  // one no flex item: Chrome gives the element no line box, whatever its
  // `white-space` or `line-height`.
  describe("an element of nothing but white space", () => {
    async function box(
      text: string,
      style: React.CSSProperties = {},
    ): Promise<LayoutNode> {
      const { tree } = await buildLayoutTree(
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            fontFamily: "Liberation Sans",
            fontSize: 20,
          }}
        >
          <div style={style}>{text}</div>
        </div>,
        400,
        400,
      );
      return tree.children[0]!.children[0]!;
    }

    it.each([
      ["  ", {}],
      ["", {}],
      ["\n", { whiteSpace: "pre-line" }],
      ["\n", { whiteSpace: "pre" }],
      ["  ", { whiteSpace: "pre" }],
      [" ", { whiteSpace: "pre-wrap" }],
      ["  ", { lineHeight: "30px" }],
      ["\f", {}],
      ["\v", {}],
    ] as const)("has no line box for %j in %j", async (text, style) => {
      const node = await box(text, style);
      expect(node.children).toHaveLength(0);
      expect([node.width, node.height]).toEqual([0, 0]);
    });

    it("still takes the size its style gives it", async () => {
      expect((await box("  ", { minHeight: 10 })).height).toBe(10);
      expect((await box("  ", { height: 17 })).height).toBe(17);
      const padded = await box("  ", { padding: 5 });
      expect([padded.width, padded.height]).toEqual([10, 10]);
    });

    it.each(["\u00a0", "\u2028"])(
      "has a line box for %j, as Chrome does",
      async (text) => {
        const node = await box(text);
        expect(node.height).toBe(23);
        expect(node.width).toBeCloseTo(5.5625, 0);
      },
    );
  });

  // Chrome sets a line or paragraph separator as a space that neither
  // collapses nor hangs, and breaks the line at neither, nor at a form feed
  // or vertical tab, under any `white-space`.
  describe("separators and control characters", () => {
    const ALL = ["normal", "nowrap", "pre-line", "pre", "pre-wrap"] as const;

    it.each(ALL)("sets a separator as a space under %s", (whiteSpace) => {
      for (const separator of ["\u2028", "\u2029"]) {
        const at = (text: string, width = 300) =>
          lines(text.replace("|", separator), whiteSpace, width).x;
        expect(at("a|b")).toEqual([expect.closeTo(272.19, 1)]);
        expect(at("a | b")).toEqual([expect.closeTo(261.08, 1)]);
        expect(at("a|")).toEqual([expect.closeTo(283.31, 1)]);
        const wraps = whiteSpace !== "nowrap" && whiteSpace !== "pre";
        expect(at("aaaa|bbbb", 60)).toEqual(
          wraps
            ? [expect.closeTo(9.94, 1), expect.closeTo(15.5, 1)]
            : [expect.closeTo(0, 1)],
        );
      }
    });

    // With letter spacing, Chrome spaces a separator once, as a space: "a b"
    // and "a\u2028b" are 42.81px with 5px of it, at 20px.
    it.each(ALL)(
      "puts letter spacing after a separator once under %s",
      (whiteSpace) => {
        for (const text of ["a b", "a\u2028b", "a\u2029b"]) {
          const result = layoutText(
            text,
            style({ whiteSpace, letterSpacing: 5 }),
            300,
          );
          expect(result.width).toBeCloseTo(42.81, 1);
        }
      },
    );

    it.each(ALL)(
      "doesn't break at a form feed or vertical tab under %s",
      (whiteSpace) => {
        for (const control of ["\f", "\v"]) {
          expect(lines(`aaaa${control}bbbb`, whiteSpace, 60).text).toEqual([
            "aaaabbbb",
          ]);
        }
      },
    );

    // Chrome draws a form feed as nothing under pre and pre-wrap.
    it.each(["pre", "pre-wrap"] as const)(
      "draws a form feed as nothing under %s",
      (whiteSpace) => {
        expect(lines("a\fb", whiteSpace).x).toEqual([
          expect.closeTo(277.75, 1),
        ]);
        expect(lines("a \f b", whiteSpace).x).toEqual([
          expect.closeTo(266.63, 1),
        ]);
      },
    );
  });
});
