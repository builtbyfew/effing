import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import type { ComputedStyle } from "../src/jsx/style/compute.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { buildLayoutTree } from "../src/jsx/layout.ts";
import type { LayoutNode } from "../src/jsx/layout.ts";
import { layoutText } from "../src/jsx/text/index.ts";
import { HAS_NATIVE_DEPS, loadFonts } from "./_helpers/setup.ts";

// White space processing as CSS Text 3 §4.1 has it (#173). The expectations
// are Chrome's, for 20px Liberation Sans in a 300px box: the lines, and where
// a right-aligned line starts.
describe.skipIf(!HAS_NATIVE_DEPS)("white space", () => {
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
    expect(lines("a   b", whiteSpace)).toEqual({
      text: ["a   b"],
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
        for (const space of [" ", "\n   ", "\t", ""]) {
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
        [<span key="a">a</span>, " ", <span key="b">b</span>],
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

    it("removes the spaces around a <br />", async () => {
      const column = await layOut(
        [
          "First line ",
          <br key="1" />,
          " second line ",
          <br key="2" />,
          " third line",
        ],
        { flexDirection: "column" },
      );
      const texts = column.children.filter((c) => c.type === "text");
      expect(
        texts.map((c) => [c.textLayout!.segments[0]!.text, c.x, c.y]),
      ).toEqual([
        ["First line", 0, 0],
        ["second line", 0, 23],
        ["third line", 0, 46],
      ]);
    });
  });
});
