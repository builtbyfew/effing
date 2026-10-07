import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { buildLayoutTree } from "../src/jsx/layout.ts";
import { DEFAULT_STYLE, resolveStyle } from "../src/jsx/style/compute.ts";
import { TextMeasure, layoutText } from "../src/jsx/text/index.ts";
import type { LayoutNode } from "../src/jsx/layout.ts";
import { loadFonts } from "./_helpers/setup.ts";

// A flex item's minimum width is its min-content width in a row (CSS
// `min-width: auto`): text that can't wrap and is wider than its box stays as
// wide as its line, and a centring parent centres it, overflowing on both
// sides. The expectations are Chrome 154's, for 40px bold Liberation Sans in
// a 300px flex box at x = 150 of a 600px frame (every div a flex container,
// as in canvas), which centres its children unless a test says otherwise:
// where each element starts and how wide it is, and where each of its lines
// starts.
describe("min-content width", () => {
  beforeAll(async () => {
    ensureFontsRegistered(await loadFonts());
  });

  const NOWRAP = "BMW Serie X X5 M Sportpakket";
  const WORD = "Supercalifragilisticexpialidocious";
  const WORDS =
    "Supercalifragilisticexpialidocious Antidisestablishmentarianism";

  type Box = { x: number; width: number; lines: number[]; texts: string[] };

  /**
   * Lay `children` out in the box, and report every element with an `id`:
   * its left edge and width, and its lines' left edges and text, in the
   * frame.
   */
  async function layOut(
    children: React.ReactNode,
    box: React.CSSProperties = {},
  ): Promise<Record<string, Box>> {
    const { tree } = await buildLayoutTree(
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
            fontFamily: "Liberation Sans",
            fontWeight: 700,
            fontSize: 40,
            ...box,
          }}
        >
          {children}
        </div>
      </div>,
      600,
      120,
    );
    return boxesIn(tree);
  }

  /**
   * Every element with an `id` in `tree`: its left edge and width, and its
   * lines' left edges and text.
   */
  function boxesIn(tree: LayoutNode): Record<string, Box> {
    const found: Record<string, Box> = {};
    const lines = (node: LayoutNode, x: number): [number, string][] => [
      ...(node.textLayout?.segments ?? []).map((s): [number, string] => [
        x + node.x + s.x,
        s.text,
      ]),
      ...node.children.flatMap((child) => lines(child, x + node.x)),
    ];
    const visit = (node: LayoutNode, x: number) => {
      const id = node.props.id;
      if (typeof id === "string") {
        const own = node.children.flatMap((child) => lines(child, x + node.x));
        found[id] = {
          x: x + node.x,
          width: node.width,
          lines: own.map(([left]) => left),
          texts: own.map(([, text]) => text),
        };
      }
      for (const child of node.children) visit(child, x + node.x);
    };
    visit(tree, 0);
    return found;
  }

  const near = (value: number) => expect.closeTo(value, 0);

  /**
   * Expect `box` where Chrome has it: its edges, which Yoga puts on whole
   * pixels, and its lines.
   */
  function expectBox(
    box: Box | undefined,
    x: number,
    width: number,
    lines: number[],
  ) {
    expectEdges(box, x, width);
    expect(box!.lines).toEqual(lines.map(near));
  }

  function expectEdges(box: Box | undefined, x: number, width: number) {
    const left = Math.round(x);
    expect(box).toEqual(
      expect.objectContaining({
        x: near(left),
        width: near(Math.round(x + width) - left),
      }),
    );
  }

  const text = (style: React.CSSProperties, content = NOWRAP) => (
    <div id="text" style={style}>
      {content}
    </div>
  );

  describe("keeps text that can't wrap as wide as its line", () => {
    it.each<[string, React.CSSProperties]>([
      ["nowrap, centred", { whiteSpace: "nowrap", textAlign: "center" }],
      ["nowrap", { whiteSpace: "nowrap" }],
      [
        "nowrap in a centring row",
        {
          whiteSpace: "nowrap",
          textAlign: "center",
          justifyContent: "center",
        },
      ],
      // Not a workaround, as it was: the text in the box shrank anyway.
      ["nowrap that doesn't shrink", { whiteSpace: "nowrap", flexShrink: 0 }],
      // `clip` makes no scroll container, which would have no minimum.
      ["nowrap, clipped", { whiteSpace: "nowrap", overflow: "clip" }],
    ])("centred in its parent: %s", async (_, style) => {
      const { text: box } = await layOut(text(style));
      expectBox(box, 3.27, 593.48, [3.27]);
    });

    it("centres a word wider than the box", async () => {
      const { text: box } = await layOut(text({ textAlign: "center" }, WORD));
      expectBox(box, -17.88, 635.77, [-17.88]);
    });

    it("centres words wider than the box, as wide as the widest", async () => {
      const { text: box } = await layOut(text({ textAlign: "center" }, WORDS));
      expectBox(box, -17.88, 635.77, [-17.88, 15.48]);
    });

    it("doesn't count a break-word break in the min-content", async () => {
      const { text: box } = await layOut(
        text({ textAlign: "center", overflowWrap: "break-word" }, WORD),
      );
      expectBox(box, -17.88, 635.77, [-17.88]);
      expect(box!.texts).toEqual([WORD]);
    });

    it("keeps preserved spaces in the min-content", async () => {
      const { text: box } = await layOut(
        text({ whiteSpace: "pre" }, "BMW Serie X  X5 M Sportpakket"),
      );
      expectBox(box, -2.3, 604.59, [-2.3]);
    });

    it("adds padding and borders", async () => {
      const { text: box } = await layOut(
        text({
          whiteSpace: "nowrap",
          paddingLeft: 20,
          paddingRight: 10,
          borderLeftWidth: 4,
          borderRightWidth: 2,
          borderStyle: "solid",
          borderColor: "red",
        }),
      );
      expectBox(box, -14.73, 629.48, [9.27]);
    });

    it("centres in a reversed row", async () => {
      const { text: box } = await layOut(text({ whiteSpace: "nowrap" }), {
        flexDirection: "row-reverse",
      });
      expectBox(box, 3.27, 593.48, [3.27]);
    });

    it("centres when its parent hides what overflows it", async () => {
      const { text: box } = await layOut(text({ whiteSpace: "nowrap" }), {
        overflow: "hidden",
      });
      expectBox(box, 3.27, 593.48, [3.27]);
    });

    it("centres across a column, as wide as its line (fit-content)", async () => {
      const { text: box } = await layOut(text({ whiteSpace: "nowrap" }), {
        flexDirection: "column",
      });
      expectBox(box, 3.27, 593.48, [3.27]);
    });

    it("centres across a column, words as wide as the widest", async () => {
      const { text: box } = await layOut(text({ textAlign: "center" }, WORDS), {
        flexDirection: "column",
      });
      expectBox(box, -17.88, 635.77, [-17.88, 15.48]);
    });

    it("keeps the text as wide as its line in a box of its own column", async () => {
      const { text: box } = await layOut(
        text({
          whiteSpace: "nowrap",
          flexDirection: "column",
          alignItems: "center",
        }),
      );
      expectBox(box, 3.27, 593.48, [3.27]);
    });

    it("grows from no flex basis no narrower than its line", async () => {
      const { text: box } = await layOut(
        text({ whiteSpace: "nowrap", flex: 1 }),
        {
          justifyContent: "flex-start",
        },
      );
      expectBox(box, 150, 593.48, [150]);
    });

    it("sizes an absolutely positioned box to its line", async () => {
      const { text: box } = await layOut(
        text({ whiteSpace: "nowrap", position: "absolute", left: 0, top: 0 }),
      );
      expectBox(box, 150, 593.48, [150]);
    });

    it("keeps a run of text next to an element as wide as its line", async () => {
      // The run is an anonymous flex item of its own, before the "!".
      const { text: box } = await layOut(
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
      );
      expectEdges(box, 150, 300);
      // Yoga puts the run on a whole pixel, to its left.
      expect(Math.abs(box!.lines[0]! - -3.41)).toBeLessThan(1);
    });

    it("lets text that can't wrap overflow a row of them", async () => {
      // Neither shrinks below its line; they overflow the box together.
      const { a, b } = await layOut(
        [
          <div key="a" id="a" style={{ fontSize: 20, whiteSpace: "nowrap" }}>
            Hello wonderful world
          </div>,
          <div key="b" id="b" style={{ fontSize: 20, whiteSpace: "nowrap" }}>
            Another item
          </div>,
        ],
        { justifyContent: "flex-start", alignItems: "flex-start" },
      );
      expectBox(a, 150, 208.89, [150]);
      expectBox(b, 358.89, 123.34, [358.89]);
    });

    it("wraps text that can't wrap to lines of its own in a wrapping row", async () => {
      const { a, b } = await layOut(
        [
          <div key="a" id="a" style={{ fontSize: 30, whiteSpace: "nowrap" }}>
            Hello wonderful world
          </div>,
          <div key="b" id="b" style={{ fontSize: 30, whiteSpace: "nowrap" }}>
            Another item
          </div>,
        ],
        {
          flexWrap: "wrap",
          alignItems: "flex-start",
          alignContent: "flex-start",
        },
      );
      expectBox(a, 143.33, 313.34, [143.33]);
      expectBox(b, 207.48, 185.02, [207.48]);
    });

    it("keeps wrapping text next to a sibling as wide as its widest word", async () => {
      const { text: box } = await layOut(
        [
          text({ fontSize: 30 }, `Hi ${WORD}`),
          <div key="s" style={{ width: 100, height: 20, flexShrink: 0 }} />,
        ],
        { justifyContent: "flex-start", alignItems: "flex-start" },
      );
      expectBox(box, 150, 476.81, [150, 150]);
    });
  });

  describe("shrinks text below its line where CSS has no minimum", () => {
    it.each<[string, React.CSSProperties, number[]]>([
      // A scroll container has no automatic minimum.
      ["that hides what overflows it", { overflow: "hidden" }, [150]],
      ["with a min-width of its own", { minWidth: 0 }, [150]],
      // Text that's alone in a flex container keeps its own minimum.
      [
        "that hides what overflows it, centring its text",
        { overflow: "hidden", justifyContent: "center" },
        [3.27],
      ],
    ])("%s", async (_, style, lines) => {
      const { text: box } = await layOut(
        text({ whiteSpace: "nowrap", ...style }),
      );
      expectBox(box, 150, 300, lines);
    });

    it.each<[string, React.CSSProperties, number, number]>([
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
    ])("to %s", async (_, style, x, width) => {
      const { text: box } = await layOut(
        text({ whiteSpace: "nowrap", ...style }),
      );
      // The text in it overflows it, from its start.
      expectBox(box, x, width, [x]);
    });

    it("stretched across a column", async () => {
      const { text: box } = await layOut(text({ whiteSpace: "nowrap" }), {
        flexDirection: "column",
        alignItems: "stretch",
      });
      expectBox(box, 150, 300, [150]);
    });

    it("stretched across a column, a break-word word whole", async () => {
      // The box's text is a flex item in its row, as wide as the word.
      const { text: box } = await layOut(
        text({ overflowWrap: "break-word" }, WORD),
        {
          flexDirection: "column",
          alignItems: "stretch",
        },
      );
      expectBox(box, 150, 300, [150]);
      expect(box!.texts).toEqual([WORD]);
    });

    it.each<[string, React.CSSProperties]>([
      ["overflow-wrap: anywhere", { overflowWrap: "anywhere" }],
      ["word-break: break-all", { wordBreak: "break-all" }],
      ["word-break: break-word", { wordBreak: "break-word" }],
    ])("breaking a word anywhere under %s", async (_, style) => {
      const { text: box } = await layOut(
        text({ textAlign: "center", ...style }, WORD),
      );
      expectBox(box, 150, 300, [155.5, 162.16, 264.44]);
    });

    it("truncating it with an ellipsis", async () => {
      const { text: box } = await layOut(
        text({
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          overflow: "hidden",
        }),
      );
      expectBox(box, 150, 300, [150]);
      // The line holds what's left of the text before the "…".
      expect(box!.texts[0]!.length).toBeLessThan(NOWRAP.length);
    });

    it("truncating it with an ellipsis, without hiding what overflows", async () => {
      // Chrome draws the ellipsis only in a box that hides what overflows it;
      // canvas draws it anyway, and so keeps the text in the box.
      const { text: box } = await layOut(
        text({ whiteSpace: "nowrap", textOverflow: "ellipsis" }),
      );
      expectBox(box, 150, 300, [150]);
      // The line holds what's left of the text before the "…".
      expect(box!.texts[0]!.length).toBeLessThan(NOWRAP.length);
    });

    it("clamping its lines", async () => {
      // Chrome's -webkit-box, -webkit-line-clamp: 2, overflow: hidden.
      const { text: box } = await layOut(
        text(
          { lineClamp: 2, overflow: "hidden" },
          `${WORD} and more words here`,
        ),
      );
      expectEdges(box, 150, 300);
      expect(box!.lines[0]).toEqual(near(150));
      expect(box!.texts).toHaveLength(2);
    });
  });

  describe("leaves text that fits as it was", () => {
    it("centres a word", async () => {
      const { text: box } = await layOut(
        text({ textAlign: "center" }, "Hello"),
      );
      expectBox(box, 251.09, 97.8, [251.09]);
    });

    it("wraps text next to a sibling", async () => {
      const { text: box } = await layOut(
        [
          text({ fontSize: 20 }, "Hello wonderful world of flex layout"),
          <div key="s" style={{ width: 100, height: 20, flexShrink: 0 }} />,
        ],
        { justifyContent: "flex-start", alignItems: "flex-start" },
      );
      expectBox(box, 150, 200, [150, 150]);
    });

    it("shrinks two runs of text that wrap side by side", async () => {
      const { a, b } = await layOut(
        [
          <div key="a" id="a" style={{ fontSize: 20 }}>
            Hello wonderful world
          </div>,
          <div key="b" id="b" style={{ fontSize: 20 }}>
            Another item that wraps
          </div>,
        ],
        { justifyContent: "flex-start", alignItems: "flex-start" },
      );
      expectBox(a, 150, 143.14, [150, 150, 150]);
      expectBox(b, 293.14, 156.86, [293.14, 293.14]);
    });
  });

  // Rows of items held at their minimums, with lengths off Chrome's grid of
  // 1/64px, where Yoga used to lose its sums. Each row is a flex row of
  // Liberation Sans in a 500px frame; the expectations are Chrome's left
  // edges and widths of its items.
  describe("holds items at their minimums in rows of any lengths", () => {
    async function layOutRow(
      box: React.CSSProperties,
      items: [React.CSSProperties, string][],
      spacer?: number,
    ): Promise<Box[]> {
      const { tree } = await buildLayoutTree(
        <div style={{ display: "flex", width: 500, height: 120 }}>
          {spacer !== undefined && <div style={{ width: spacer }} />}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              fontFamily: "Liberation Sans",
              fontWeight: 400,
              ...box,
            }}
          >
            {items.map(([style, content], i) => (
              <div key={i} id={`item${i}`} style={style}>
                {content}
              </div>
            ))}
          </div>
        </div>,
        500,
        120,
      );
      const found = boxesIn(tree);
      return items.map((_, i) => found[`item${i}`]!);
    }

    const expectItems = (boxes: Box[], expected: [number, number][]) =>
      expected.forEach(([x, width], i) => expectEdges(boxes[i], x, width));

    it("with fractional padding", async () => {
      const items = await layOutRow({ width: 300 }, [
        [
          { fontSize: 20, whiteSpace: "nowrap", paddingLeft: 3.3 },
          "Hello wonderful world",
        ],
        [{ fontSize: 20, whiteSpace: "nowrap" }, "Another item"],
      ]);
      expectItems(items, [
        [0, 194.5],
        [194.5, 113.39],
      ]);
    });

    it("capped at a percentage width", async () => {
      // The minimum is the smaller of the width and the text's.
      const style: React.CSSProperties = {
        fontSize: 20,
        fontWeight: 700,
        whiteSpace: "nowrap",
        width: "60%",
      };
      const items = await layOutRow({ width: 300 }, [
        [style, "Hello wonderful world"],
        [style, "Another item"],
      ]);
      expectItems(items, [
        [0, 180],
        [180, 123.34],
      ]);
    });

    it("with percentage padding", async () => {
      const items = await layOutRow(
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
      );
      expectItems(items, [[-11.73, 623.48]]);
    });

    it("capped at a percentage max width", async () => {
      const items = await layOutRow({ width: 300 }, [
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
      ]);
      expectItems(items, [
        [0, 240],
        [240, 100],
      ]);
    });

    it("all of them, at percentages and fractions", async () => {
      const items = await layOutRow(
        { width: 183.191, columnGap: 6.542, justifyContent: "center" },
        [
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
        ],
      );
      expectItems(items, [
        [-11.81, 48.67],
        [43.39, 51.03],
        [100.95, 54.05],
        [161.53, 33.47],
      ]);
    });

    it("with words wider than the row", async () => {
      const items = await layOutRow({ width: 120.37 }, [
        [{ fontSize: 20, paddingLeft: 3.3 }, "Hi Supercalifragilistic"],
        [
          { fontSize: 20, paddingLeft: "2.7%", paddingRight: 1.9 },
          "wonderful Sportpakket",
        ],
      ]);
      expectItems(items, [
        [0, 164.47],
        [164.47, 111.86],
      ]);
    });

    // Yoga sized these out of all proportion, at millions of pixels.
    it("in a row a few pixels wide", async () => {
      const items = await layOutRow({ width: "1.16%" }, [
        [
          { fontSize: 33, whiteSpace: "nowrap", paddingLeft: 7.91 },
          "item item",
        ],
        [
          {
            fontSize: 37,
            whiteSpace: "nowrap",
            flex: 1,
            paddingLeft: "7.418%",
          },
          "world layout item",
        ],
      ]);
      expectItems(items, [
        [0, 141.77],
        [141.77, 278.03],
      ]);
    });

    it("that shrink by fractions", async () => {
      // This row ran away before automatic minimums too.
      const items = await layOutRow({ width: 14.626, columnGap: 1.928 }, [
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
      ]);
      expectItems(items, [
        [0, 97.39],
        [99.31, 60.64],
        [161.88, 33.66],
        [198.8, 168.69],
      ]);
    });

    // The element has no automatic minimum, but its text does, in the
    // element's own row: it overflows the element. Holding it there leaves
    // the element's flex basis as it was. Chrome makes the element 167.86px
    // (165.27px next to 290px), as it takes its flex basis from the text's
    // max-content, where Yoga takes it at the width available: Yoga shares
    // the shrinking out by that as it did before.
    it.each<[string, React.CSSProperties, number, number]>([
      ["hides what overflows it", { overflow: "hidden" }, 280, 155],
      ["has no min width", { minWidth: 0 }, 280, 155],
      [
        "hides what overflows it, next to more",
        { overflow: "hidden" },
        290,
        153,
      ],
      ["has no min width, next to more", { minWidth: 0 }, 290, 153],
    ])(
      "shrinks an element that %s by its flex basis",
      async (_, style, sibling, width) => {
        const items = await layOutRow({ width: 300 }, [
          [
            { fontSize: 20, ...style },
            "Supercalifragilistic and more words here",
          ],
          [{ width: sibling, height: 10, flexShrink: 1 }, ""],
        ]);
        expectItems(items, [
          [0, width],
          [width, 300 - width],
        ]);
        // Its text starts at its start, as wide as its widest word.
        expect(items[0]!.lines[0]).toEqual(near(0));
        expect(items[0]!.texts).toContain("Supercalifragilistic");
      },
    );

    it("leaves a wide item that doesn't shrink as wide as it is", async () => {
      // An item that wide elsewhere takes nothing from the automatic minimum
      // of text that doesn't fit.
      const { tree } = await buildLayoutTree(
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
              fontFamily: "Liberation Sans",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            <div id="text" style={{ whiteSpace: "nowrap" }}>
              {NOWRAP}
            </div>
          </div>
        </div>,
        500,
        300,
      );
      const found = boxesIn(tree);
      expectEdges(found.strip, 0, 70_000);
      expectEdges(found.text, -146.73, 593.48);
    });

    it("keeps text far wider than the canvas as wide as its line", async () => {
      const ticker = "Ticker headline number one and more news ".repeat(600);
      const [item] = await layOutRow({ width: 500 }, [
        [{ fontSize: 20, whiteSpace: "nowrap" }, ticker],
      ]);
      // Chrome makes it 236,795.59px, which Skia's advances come to within
      // 0.01%.
      expect(item!.x).toBe(0);
      expect(item!.width / 236_795.59).toBeCloseTo(1, 3);
    });
  });

  it("measures text at exactly a width for its height there", () => {
    // A stretched item is as wide as its box, whatever its text: Yoga asks
    // for the height at that width, which isn't the text's min-content.
    const style = resolveStyle(
      { fontFamily: "Liberation Sans", fontSize: 20 },
      DEFAULT_STYLE,
    );
    const content = `${WORD} and more`;
    const measure = new TextMeasure(content, style);
    const atMost = measure.measure(100);
    const exactly = measure.measure(100, true);
    expect(atMost.width).toBeGreaterThan(100);
    expect(exactly).toEqual({
      width: 100,
      height: layoutText(content, style, 100).height,
    });
  });
});
