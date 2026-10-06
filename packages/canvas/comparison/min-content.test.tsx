import { beforeAll, describe, expect, it } from "vitest";
import React from "react";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { buildLayoutTree } from "../src/jsx/layout.ts";
import type { LayoutNode } from "../src/jsx/layout.ts";
import { HAS_NATIVE_DEPS, loadFonts } from "./_helpers/setup.ts";

// A flex item's minimum width is its min-content width in a row (CSS
// `min-width: auto`): text that can't wrap and is wider than its box stays as
// wide as its line, and a centring parent centres it, overflowing on both
// sides. The expectations are Chrome 154's, for 40px bold Liberation Sans in
// a 300px flex box at x = 150 of a 600px frame (every div a flex container,
// as in canvas), which centres its children unless a test says otherwise:
// where each element starts and how wide it is, and where each of its lines
// starts.
describe.skipIf(!HAS_NATIVE_DEPS)("min-content width", () => {
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
});
