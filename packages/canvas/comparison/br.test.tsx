import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import type { ComputedStyle } from "../src/jsx/style/compute.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { buildLayoutTree } from "../src/jsx/layout.ts";
import type { LayoutNode } from "../src/jsx/layout.ts";
import { layoutText } from "../src/jsx/text/index.ts";
import { HAS_NATIVE_DEPS, loadFonts } from "./_helpers/setup.ts";

// A <br> is a forced line break in the run of text around it, which a flex
// container lays out as one anonymous flex item (#175). The expectations are
// Chrome's, for 20px Liberation Sans (23px lines) in a 300px flex container
// with `align-items: flex-start`: the lines' text, where each starts and its
// top, and the container's height.
describe.skipIf(!HAS_NATIVE_DEPS)("<br>", () => {
  beforeAll(async () => {
    ensureFontsRegistered(await loadFonts());
  });

  async function layOut(
    children: React.ReactNode,
    style: React.CSSProperties = {},
    emojiEnabled = false,
  ): Promise<LayoutNode> {
    const { tree } = await buildLayoutTree(
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          // As tall as its content, in the canvas-sized row it's laid out in.
          alignSelf: "flex-start",
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
      emojiEnabled,
    );
    return tree.children[0]!;
  }

  // Canvas sizes `normal` line boxes from the font's hhea ascent and descent
  // (22.34px), where Chrome adds its line gap (23px): the lines of one text
  // node are 22.34px apart, those of separate items 23px (rounded up). So
  // tops and heights are compared on Chrome's 23px grid of lines.
  const LINE = 23;
  const onGrid = (value: number) => Math.round(value / LINE) * LINE;

  /** Every line of text in `node`: its text, left edge and top. */
  function lines(node: LayoutNode, x = 0, y = 0): [string, number, number][] {
    const left = x + node.x;
    const top = y + node.y;
    const own = (node.textLayout?.segments ?? []).map(
      (seg): [string, number, number] => [
        seg.text,
        left + seg.x,
        onGrid(top + seg.lineIndex * seg.height),
      ],
    );
    return [
      ...own,
      ...node.children.flatMap((child) => lines(child, left, top)),
    ];
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  /** The lines with text in them, as Chrome reports a text node's. */
  const textLines = (node: LayoutNode) =>
    lines(node, -node.x, -node.y).filter(([text]) => text !== "");

  // Yoga places elements on whole pixels.
  const near = (value: number) => expect.closeTo(value, 0);

  /** Expect `node`'s lines with text, each at Chrome's left edge to 0.5px. */
  function expectLines(node: LayoutNode, expected: [string, number, number][]) {
    expect(textLines(node)).toEqual(
      expected.map(([text, x, y]) => [text, near(x), y]),
    );
  }

  /** Expect `node` to be `height` tall, on Chrome's grid of lines. */
  function expectHeight(node: LayoutNode, height: number) {
    expect(onGrid(node.height)).toBe(height);
  }

  describe("in a row", () => {
    it("stacks the text either side of it", async () => {
      const row = await layOut(["First line ", <br key="1" />, " second line"]);
      expectHeight(row, 46);
      expectLines(row, [
        ["First line", 0, 0],
        ["second line", 0, 23],
      ]);
    });

    it("stacks three lines", async () => {
      const row = await layOut(
        <>
          First line <br /> second line <br /> third line
        </>,
      );
      expectHeight(row, 69);
      expectLines(row, [
        ["First line", 0, 0],
        ["second line", 0, 23],
        ["third line", 0, 46],
      ]);
    });

    // The run is as wide as its widest line, so the next item follows it.
    it("keeps the run as narrow as its lines next to other elements", async () => {
      const row = await layOut([
        <span key="x">x</span>,
        "a",
        <br key="1" />,
        "b",
        <span key="y">y</span>,
        "c",
        <br key="2" />,
        "d",
      ]);
      expectHeight(row, 46);
      expect(row.children.map((c) => [c.type, c.x])).toEqual([
        ["span", near(0)],
        ["text", near(10)],
        ["span", near(21.13)],
        ["text", near(31.13)],
      ]);
      expectLines(row, [
        ["x", 0, 0],
        ["a", 10, 0],
        ["b", 10, 23],
        ["y", 21.13, 0],
        ["c", 31.13, 0],
        ["d", 31.13, 23],
      ]);
    });

    // A <br> on its own between elements is an item of one empty line.
    it("makes a <br> between elements an empty line of its own", async () => {
      const row = await layOut([
        <span key="a">a</span>,
        <br key="1" />,
        <span key="b">b</span>,
      ]);
      expectHeight(row, 23);
      expect(row.children.map((c) => [c.type, c.x, c.height])).toEqual([
        ["span", near(0), 23],
        ["text", near(11.13), 23],
        ["span", near(11.13), 23],
      ]);
    });

    it("starts the run after an element with a <br>", async () => {
      const row = await layOut([<span key="x">x</span>, <br key="1" />, "a"]);
      expectHeight(row, 46);
      expectLines(row, [
        ["x", 0, 0],
        ["a", 10, 23],
      ]);
    });

    it("ends the run before an element with a <br>", async () => {
      const row = await layOut(["a", <br key="1" />, <span key="x">x</span>]);
      expectHeight(row, 23);
      expectLines(row, [
        ["a", 0, 0],
        ["x", 11.13, 0],
      ]);
    });

    it("breaks the text of an element with a <br> in it", async () => {
      const row = await layOut([
        <span key="a">
          a<br />b
        </span>,
        <span key="c">c</span>,
      ]);
      expectHeight(row, 46);
      expectLines(row, [
        ["a", 0, 0],
        ["b", 0, 23],
        ["c", 11.13, 0],
      ]);
    });
  });

  describe("in a column", () => {
    it("stacks the text either side of it", async () => {
      const column = await layOut(
        ["First line ", <br key="1" />, " second line"],
        { flexDirection: "column" },
      );
      expectHeight(column, 46);
      expectLines(column, [
        ["First line", 0, 0],
        ["second line", 0, 23],
      ]);
    });

    it("makes a <br> between elements an empty line of its own", async () => {
      for (const space of ["", " "]) {
        const column = await layOut(
          [
            <span key="a">a</span>,
            space,
            <br key="1" />,
            space,
            <span key="b">b</span>,
          ],
          { flexDirection: "column" },
        );
        expectHeight(column, 69);
        expectLines(column, [
          ["a", 0, 0],
          ["b", 0, 46],
        ]);
      }
    });

    it("breaks the runs between elements", async () => {
      const column = await layOut(
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
      );
      expectHeight(column, 138);
      expect(textLines(column).map(([text, , y]) => [text, y])).toEqual([
        ["x", 0],
        ["a", 23],
        ["b", 46],
        ["y", 69],
        ["c", 92],
        ["d", 115],
      ]);
    });
  });

  describe("at the start and end, and several in a row", () => {
    it.each([
      ["a <br> at the start", [<br key="1" />, "First"], 46, [["First", 23]]],
      ["a <br> at the end", ["First", <br key="1" />], 23, [["First", 0]]],
      [
        "two <br>s at the end",
        ["First", <br key="1" />, <br key="2" />],
        46,
        [["First", 0]],
      ],
      [
        "two <br>s",
        ["a", <br key="1" />, <br key="2" />, "b"],
        69,
        [
          ["a", 0],
          ["b", 46],
        ],
      ],
      [
        "three <br>s",
        ["a", <br key="1" />, <br key="2" />, <br key="3" />, "b"],
        92,
        [
          ["a", 0],
          ["b", 69],
        ],
      ],
      [
        "two <br>s at the start",
        [<br key="1" />, <br key="2" />, "a"],
        69,
        [["a", 46]],
      ],
      ["nothing but a <br>", [<br key="1" />], 23, []],
      ["nothing but two <br>s", [<br key="1" />, <br key="2" />], 46, []],
      ["a <br> in white space", [" ", <br key="1" />, " "], 23, []],
    ] as const)(
      "lays out %s as Chrome does",
      async (_, children, height, expected) => {
        for (const flexDirection of ["row", "column"] as const) {
          const node = await layOut(children, { flexDirection });
          expectHeight(node, height);
          expect(textLines(node).map(([text, , y]) => [text, y])).toEqual(
            expected,
          );
        }
      },
    );
  });

  // React has fragments, arrays and components, the DOM doesn't: the <br>s in
  // them are in the run of text around them.
  it("breaks the run across fragments, arrays and components", async () => {
    const Br = () => <br />;
    const Lines = () => ["First line ", <br key="1" />, " second"];
    for (const children of [
      [
        "First line ",
        <React.Fragment key="f">
          <br />
        </React.Fragment>,
        " second",
      ],
      ["First line ", [<br key="1" />], " second"],
      ["First line ", <Br key="b" />, " second"],
      [<Lines key="l" />],
      <>
        <>First line </>
        <Br />
        {[" ", "second"]}
      </>,
    ]) {
      const row = await layOut(children);
      expectLines(row, [
        ["First line", 0, 0],
        ["second", 0, 23],
      ]);
    }
  });

  it("ignores a <br> with display: none", async () => {
    const row = await layOut([
      "First line ",
      <br key="1" style={{ display: "none" }} />,
      " second line",
    ]);
    expectHeight(row, 23);
    expectLines(row, [["First line second line", 0, 0]]);
    expect(row.children[0]!.textLayout!.width).toBeCloseTo(182.31, 1);
  });

  describe("white space", () => {
    // Right-aligned in the full 300px, where Chrome stretches the item.
    const rightAligned = (whiteSpace: ComputedStyle["whiteSpace"]) => ({
      flexDirection: "column" as const,
      alignItems: "stretch" as const,
      textAlign: "right" as const,
      whiteSpace,
    });

    it.each(["normal", "nowrap", "pre-line"] as const)(
      "removes the spaces around a <br> under %s",
      async (whiteSpace) => {
        const column = await layOut(
          ["a ", <br key="1" />, " b"],
          rightAligned(whiteSpace),
        );
        expectLines(column, [
          ["a", 288.88, 0],
          ["b", 288.88, 23],
        ]);
        const tabs = await layOut(
          ["a \t\n ", <br key="1" />, " \t\n b"],
          rightAligned(whiteSpace),
        );
        expectHeight(tabs, whiteSpace === "pre-line" ? 92 : 46);
      },
    );

    it.each(["normal", "nowrap"] as const)(
      "removes tabs and newlines around a <br> under %s",
      async (whiteSpace) => {
        const column = await layOut(
          ["a \t\n ", <br key="1" />, " \t\n b"],
          rightAligned(whiteSpace),
        );
        expectLines(column, [
          ["a", 288.88, 0],
          ["b", 288.88, 23],
        ]);
      },
    );

    it.each(["pre", "pre-wrap"] as const)(
      "keeps the spaces around a <br> under %s",
      async (whiteSpace) => {
        const column = await layOut(
          ["a ", <br key="1" />, " b"],
          rightAligned(whiteSpace),
        );
        expectLines(column, [
          ["a ", 283.31, 0],
          [" b", 283.31, 23],
        ]);
      },
    );

    // A newline next to a <br> is a forced break of its own.
    it.each(["pre-line", "pre", "pre-wrap"] as const)(
      "breaks at both a newline and a <br> under %s",
      async (whiteSpace) => {
        for (const children of [
          ["a\n", <br key="1" />, "b"],
          ["a", <br key="1" />, "\nb"],
        ]) {
          const row = await layOut(children, { whiteSpace });
          expectHeight(row, 69);
          expectLines(row, [
            ["a", 0, 0],
            ["b", 0, 46],
          ]);
        }
      },
    );

    it("starts no line after a newline and a <br> that end the text", async () => {
      for (const children of [
        ["a\n", <br key="1" />],
        ["a", <br key="1" />, "\n"],
      ]) {
        const row = await layOut(children, { whiteSpace: "pre" });
        expectHeight(row, 46);
      }
    });

    it("turns the newlines around a <br> into nothing under normal", async () => {
      const row = await layOut(["a\n", <br key="1" />, "\nb"]);
      expectHeight(row, 46);
    });

    it("keeps a line separator before a <br> a space", async () => {
      const column = await layOut(
        ["a\u2028", <br key="1" />, "b"],
        rightAligned("normal"),
      );
      expect(textLines(column).map(([, x, y]) => [x, y])).toEqual([
        [near(283.31), 0],
        [near(288.88), 23],
      ]);
    });

    it("keeps the no-break spaces around a <br>", async () => {
      const column = await layOut(
        ["a\u00a0", <br key="1" />, "\u00a0b"],
        rightAligned("normal"),
      );
      expectLines(column, [
        ["a\u00a0", 283.31, 0],
        ["\u00a0b", 283.31, 23],
      ]);
    });

    // Under nowrap, a <br> still breaks the line, and only a <br> does.
    it("breaks at a <br> under nowrap", async () => {
      const row = await layOut(
        [
          "Hello world again and more ",
          <br key="1" />,
          " words here and some more",
        ],
        { whiteSpace: "nowrap" },
      );
      expectLines(row, [
        ["Hello world again and more", 0, 0],
        ["words here and some more", 0, 23],
      ]);
    });

    it("wraps the lines between <br>s", async () => {
      const row = await layOut(
        ["Hello world again and more words here ", <br key="1" />, " next"],
        { width: 150 },
      );
      expectHeight(row, 92);
      expect(textLines(row).map(([text, , y]) => [text, y])).toEqual([
        ["Hello world", 0],
        ["again and more", 23],
        ["words here", 46],
        ["next", 69],
      ]);
    });
  });

  describe("text-align", () => {
    const aligned = (textAlign: "right" | "center") => ({
      flexDirection: "column" as const,
      alignItems: "stretch" as const,
      textAlign,
    });

    it.each([
      ["right", [224.42, 198.81, 224.39]],
      ["center", [112.2, 99.41, 112.19]],
    ] as const)("aligns each line %s", async (textAlign, x) => {
      const column = await layOut(
        <>
          First line <br /> second line <br /> third line
        </>,
        aligned(textAlign),
      );
      expect(textLines(column).map(([, left]) => left)).toEqual(
        x.map((value) => expect.closeTo(value, 1)),
      );
    });

    it("aligns the lines of a wrapped line", async () => {
      const column = await layOut(["aaa bbb ", <br key="1" />, " ccc"], {
        ...aligned("right"),
        width: 60,
      });
      expectLines(column, [
        ["aaa", 26.63, 0],
        ["bbb", 26.63, 23],
        ["ccc", 30, 46],
      ]);
    });
  });

  // Chrome draws 🎉 in Apple Color Emoji, 2px wider than the box canvas
  // leaves for its image, so only where the lines end is compared: Chrome
  // ends both at 300px, with an emoji on each.
  it("breaks next to an emoji", async () => {
    const column = await layOut(
      ["Hi 🎉 ", <br key="1" />, " 🎉 there"],
      { flexDirection: "column", alignItems: "stretch", textAlign: "right" },
      true,
    );
    const { segments, emoji } = column.children[0]!.textLayout!;
    expect(segments.map((seg) => [seg.text, seg.x + seg.width])).toEqual([
      ["Hi 🎉", near(300)],
      ["🎉 there", near(300)],
    ]);
    expect(emoji.map((e) => e.baseline)).toEqual(segments.map((seg) => seg.y));
  });

  describe("with line-clamp and text-overflow", () => {
    const style = (s: Partial<ComputedStyle>) =>
      ({
        fontFamily: "Liberation Sans",
        fontSize: 20,
        color: "black",
        ...s,
      }) as ComputedStyle;

    /** The lines, and each one's width with its ellipsis. */
    const clamped = (pieces: string[], s: Partial<ComputedStyle>) => {
      const result = layoutText(pieces, style(s), 150);
      return result.segments.map((seg) => [seg.text, round(seg.width)]);
    };

    // Chrome puts an ellipsis after the last line when there's more text.
    it.each<[string[], [string, number][]]>([
      [
        ["a", "b", "c"],
        [
          ["a", 11.13],
          ["b", 31.13],
        ],
      ],
      [
        ["Hello world", "again and more words", "last"],
        [
          ["Hello world", 98.92],
          ["again and mor", 147.88],
        ],
      ],
      [
        ["a", "b"],
        [
          ["a", 11.13],
          ["b", 11.13],
        ],
      ],
      [
        ["a", "b", ""],
        [
          ["a", 11.13],
          ["b", 11.13],
        ],
      ],
      [
        ["a", "", "c"],
        [
          ["a", 11.13],
          ["", 20],
        ],
      ],
    ])("clamps %j to two lines as Chrome does", (pieces, expected) => {
      expect(clamped(pieces, { lineClamp: 2 })).toEqual(
        expected.map(([text, width]) => [text, expect.closeTo(width, 1)]),
      );
    });

    // Chrome sizes the clamped item to its widest line, 155.67px, without
    // the ellipsis, and truncates that line to fit it: "A longer line h…".
    it.each([
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
    ] as const)(
      "sizes clamped lines with %s to the widest, without its ellipsis",
      async (_, children, whiteSpace) => {
        const column = await layOut(
          <div style={{ lineClamp: 2, whiteSpace }}>{children}</div>,
          { flexDirection: "column" },
        );
        const clampedBox = column.children[0]!;
        expect(clampedBox.width).toBeCloseTo(155.67, 0);
        const { segments } = clampedBox.children[0]!.textLayout!;
        expect(segments.map((seg) => [seg.text, round(seg.width)])).toEqual([
          ["Short", expect.closeTo(47.81, 1)],
          ["A longer line h", expect.closeTo(146.77, 1)],
        ]);
      },
    );

    it("truncates each line between <br>s under nowrap", () => {
      expect(
        clamped(
          [
            "Hello world again and more",
            "short",
            "another very long line here",
          ],
          {
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          },
        ),
      ).toEqual([
        ["Hello world ag", expect.closeTo(146.73, 1)],
        ["short", expect.closeTo(44.47, 1)],
        ["another very l", expect.closeTo(141.17, 1)],
      ]);
    });
  });
});
