import { beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import type { FontData } from "../src/types.ts";
import type { ComputedStyle } from "../src/jsx/style/compute.ts";
import { ensureFontsRegistered } from "../src/jsx/font.ts";
import { buildLayoutTree } from "../src/jsx/layout.ts";
import type { LayoutNode } from "../src/jsx/layout.ts";
import { layoutText } from "../src/jsx/text/index.ts";
import {
  HAS_NATIVE_DEPS,
  compareImages,
  loadFonts,
  loadScriptFonts,
  SCRIPT_FONT_FAMILIES,
  renderWithCanvas,
  renderWithSatori,
} from "./_helpers/setup.ts";

const TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

// Text laid out as one native paragraph (@effing/skia's `Paragraph`), which
// Skia breaks, shapes and paints.
describe.skipIf(!HAS_NATIVE_DEPS)("native paragraph layout", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
    ensureFontsRegistered(fonts);
    ensureFontsRegistered(await loadScriptFonts());
  });

  const style = (s: Partial<ComputedStyle>) =>
    ({
      fontFamily: "Liberation Sans",
      color: "black",
      ...s,
    }) as ComputedStyle;

  // Widths at which a line ends exactly at, or just short of, a word: a
  // line's trailing space must not count toward whether it fits.
  it.each([
    [69, 16],
    [105, 16],
    [150, 20],
    [177, 24],
  ])("wraps a %spx-wide %spx paragraph like satori", async (w, fontSize) => {
    const element = (
      <div
        style={{
          width: 300,
          height: 400,
          display: "flex",
          background: "white",
          fontFamily: "Liberation Sans",
        }}
      >
        <div style={{ width: w, fontSize, color: "black", display: "block" }}>
          {TEXT}
        </div>
      </div>
    );
    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, 300, 400, fonts),
      renderWithSatori(element, 300, 400, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      `native-wrap-${w}-${fontSize}`,
    );
    expect(percentage).toBeLessThan(1.2);
  });

  it("places lines on CSS half-leading baselines from the hhea metrics", () => {
    // Liberation Sans: hhea ascender 1854, descender -434, unitsPerEm 2048.
    const ascent = (1854 / 2048) * 20;
    const descent = (434 / 2048) * 20;
    const result = layoutText(
      TEXT,
      style({ fontSize: 20, lineHeight: 30 }),
      200,
    );
    expect(result.paragraph).toBeDefined();
    expect(result.segments.length).toBeGreaterThan(2);
    result.segments.forEach((seg, i) => {
      expect(seg.y).toBeCloseTo(i * 30 + (30 + ascent - descent) / 2, 4);
    });
    expect(result.height).toBeCloseTo(result.segments.length * 30, 4);
  });

  it("sizes `normal` line boxes from the hhea metrics, rounded up", () => {
    const result = layoutText("Hello", style({ fontSize: 20 }), 10_000);
    // (1854 + 434) / 2048 * 20 = 22.34…
    expect(result.segments[0]!.height).toBeCloseTo(22.3438, 3);
    expect(result.height).toBe(23);
  });

  it("measures and centres an ellipsized line with its ellipsis", () => {
    const result = layoutText(
      TEXT,
      style({ fontSize: 20, lineClamp: 2, textAlign: "center" }),
      300,
    );
    expect(result.segments).toHaveLength(2);
    const last = result.segments[1]!;
    const clipped = layoutText(TEXT, style({ fontSize: 20, lineClamp: 2 }), 300)
      .segments[1]!;
    // The painted line is its text plus "…", wider than the text alone.
    expect(last.width).toBeGreaterThan(
      layoutText(last.text, style({ fontSize: 20 }), 10_000).width,
    );
    expect(last.x + last.width / 2).toBeCloseTo(150, 3);
    expect(clipped.x).toBe(0);
  });

  it("puts letter spacing after each glyph, as CSS does", () => {
    const plain = layoutText("Hello", style({ fontSize: 20 }), 10_000);
    const spaced = layoutText(
      "Hello",
      style({ fontSize: 20, letterSpacing: 3 }),
      10_000,
    );
    expect(spaced.segments[0]!.x).toBe(0);
    expect(spaced.width).toBeCloseTo(plain.width + 5 * 3, 3);
  });

  // The tests below hold Chrome 154's lines for the same text, font (Liberation
  // Sans, 20px) and width.

  it.each([
    [
      "A supercalifragilisticexpialidocious word here",
      80,
      ["A", "supercalifragilisticexpialidocious", "word", "here"],
    ],
    [
      "A supercalifragilisticexpialidocious word here",
      120,
      ["A", "supercalifragilisticexpialidocious", "word here"],
    ],
    // Skia's min-intrinsic width used to count a last word by its pieces.
    ["over lazy here", 39, ["over", "lazy", "here"]],
  ])(
    "leaves a word wider than the box unbroken, to overflow: %s at %spx",
    (text, width, lines) => {
      const result = layoutText(text, style({ fontSize: 20 }), width);
      expect(result.segments.map((s) => s.text)).toEqual(lines);
      expect(result.width).toBeGreaterThan(width);
    },
  );

  it.each([
    [
      "A supercalifragilisticexpialidocious word here",
      80,
      ["A", "supercal", "ifragilisti", "cexpialid", "ocious", "word", "here"],
    ],
    [
      "A supercalifragilisticexpialidocious word here",
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
  ])(
    "breaks a word wider than the box under break-word, as Chrome does: %s at %spx",
    (text, width, lines) => {
      for (const s of [
        { wordBreak: "break-word" },
        { overflowWrap: "break-word" },
      ] as const) {
        const result = layoutText(text, style({ fontSize: 20, ...s }), width);
        expect(result.segments.map((seg) => seg.text)).toEqual(lines);
      }
    },
  );

  it.each([
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
      "A supercalifragilisticexpialidocious word here",
      100,
      ["A supercali", "fragilisticex", "pialidociou", "s word her", "e"],
    ],
  ])(
    "breaks between any two letters under break-all, as Chrome does: %#",
    (text, width, lines) => {
      const result = layoutText(
        text,
        style({ fontSize: 20, wordBreak: "break-all" }),
        width,
      );
      expect(result.segments.map((s) => s.text)).toEqual(lines);
    },
  );

  // Thai, Lao and Burmese are written without spaces between words; Skia
  // breaks them between dictionary words, which UAX #14 alone can't find.
  // They're set in bundled Noto fonts, not whatever the system falls back to.
  it.each([
    [
      "Thai",
      "ภาษาไทยเป็นภาษาที่มีระดับเสียงของคำแน่นอนหรือวรรณยุกต์เช่นเดียวกับภาษาจีน",
    ],
    ["Lao", "ພາສາລາວເປັນພາສາທີ່ມີວັນນະຍຸດເຊັ່ນດຽວກັບພາສາໄທ"],
    ["Burmese", "မြန်မာဘာသာစကားသည် မြန်မာနိုင်ငံ၏ ရုံးသုံးဘာသာစကား ဖြစ်သည်"],
    ["Thai among English", "Hello ภาษาไทยเป็นภาษาที่มีระดับเสียง world"],
  ])("wraps %s between words", (_, text) => {
    const result = layoutText(
      text,
      style({
        fontFamily: `Liberation Sans, ${SCRIPT_FONT_FAMILIES}`,
        fontSize: 20,
      }),
      150,
    );
    expect(result.segments.length).toBeGreaterThan(2);
    for (const seg of result.segments) {
      expect(seg.width).toBeLessThanOrEqual(150);
    }
  });

  // Chrome fits three of these characters on a line in the 70px it was given
  // (its Japanese fallback font is 20.39px wide at 20px), so the width is
  // three and a half of whatever font sets them here.
  const cjkWidth = (s: ComputedStyle) =>
    3.5 * layoutText("東", s, Infinity).width;

  // Small kana and "ー" (UAX #14 class CJ) may start a line, as in browsers
  // and Skia under `line-break: auto`.
  it.each([
    ["東京ディズニーランド", ["東京デ", "ィズニ", "ーラン", "ド"]],
    [
      "きゃりーぱみゅぱみゅのコンサート",
      ["きゃり", "ーぱみ", "ゅぱみ", "ゅのコ", "ンサー", "ト"],
    ],
  ])("breaks Japanese before small kana and ー: %s", (text, lines) => {
    const s = style({ fontSize: 20 });
    const result = layoutText(text, s, cjkWidth(s));
    expect(result.segments.map((seg) => seg.text)).toEqual(lines);
  });

  it("breaks CJK text only at spaces under keep-all, as Chrome does", () => {
    const text = "東京ディズニーランド へ ようこそ";
    const keepAll = style({ fontSize: 20, wordBreak: "keep-all" });
    expect(
      layoutText(text, keepAll, cjkWidth(keepAll)).segments.map((s) => s.text),
    ).toEqual(["東京ディズニーランド", "へ", "ようこそ"]);
  });

  // A word broken under break-word breaks between grapheme clusters.
  it.each([
    ["a family emoji", "👨‍👩‍👧‍👦👨‍👩‍👧‍👦"],
    ["a Devanagari conjunct", "नमस्ते"],
  ])("keeps %s whole when break-word breaks a word", (_, text) => {
    const breakWord = style({ fontSize: 20, wordBreak: "break-word" });
    const lines = layoutText(text, breakWord, 30).segments.map((s) => s.text);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
    const graphemes = [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        text,
      ),
    ].map((g) => g.segment);
    // Each line is a run of whole clusters.
    let i = 0;
    for (const line of lines) {
      let run = "";
      while (run.length < line.length) run += graphemes[i++];
      expect(run).toBe(line);
    }
  });

  it("keeps one empty line box for empty text", () => {
    // Liberation Sans: hhea ascender 1854, descender -434, unitsPerEm 2048.
    const ascent = (1854 / 2048) * 20;
    const descent = (434 / 2048) * 20;
    for (const [lineHeight, box, height] of [
      [undefined, ascent + descent, 23],
      [30, 30, 30],
    ]) {
      const result = layoutText("", style({ fontSize: 20, lineHeight }), 300);
      expect(result.height).toBe(height);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]!.height).toBeCloseTo(box!, 4);
      expect(result.segments[0]!.y).toBeCloseTo(
        (box! + ascent - descent) / 2,
        4,
      );
    }
  });

  it("start-aligns a centred or right-aligned line that overflows, as browsers do", () => {
    for (const textAlign of ["center", "right"] as const) {
      const overflowing = layoutText(
        "An overflowing title",
        style({ fontSize: 20, whiteSpace: "nowrap", textAlign }),
        100,
      );
      expect(overflowing.segments[0]!.width).toBeGreaterThan(100);
      expect(overflowing.segments[0]!.x).toBe(0);
      const word = layoutText(
        "Supercalifragilistic",
        style({ fontSize: 20, textAlign }),
        100,
      );
      expect(word.segments[0]!.x).toBe(0);
    }
  });

  it.each(["pre", "pre-wrap"] as const)(
    "keeps the trailing spaces of white-space: %s in the line, as Chrome does",
    (whiteSpace) => {
      const result = layoutText(
        "Hello   \nab",
        style({ fontSize: 20, whiteSpace, textAlign: "right" }),
        300,
      );
      // Chrome puts "Hello" at 237.75 and "ab" at 277.75.
      expect(result.segments.map((s) => s.x)).toEqual([
        expect.closeTo(237.75, 1),
        expect.closeTo(277.75, 1),
      ]);
      expect(result.segments[0]!.width).toBeCloseTo(300 - 237.75, 1);
    },
  );

  it("collapses the line boxes for a line height of 0, as Chrome does", () => {
    const result = layoutText(
      "Hello world again",
      style({ fontSize: 20, lineHeight: 0 }),
      80,
    );
    expect(result.height).toBe(0);
    expect(result.segments.map((s) => s.text)).toEqual([
      "Hello",
      "world",
      "again",
    ]);
    // Every line's baseline is where the glyphs centre on the collapsed line
    // box: (ascent - descent) / 2 below it.
    for (const seg of result.segments) {
      expect(seg.y).toBeCloseTo(((1854 - 434) / 2048) * 10, 4);
    }
  });

  describe("emoji drawn as images", () => {
    it("sets each emoji in a box of 1em, 0.1em below the baseline", () => {
      const result = layoutText(
        "Hello 🌍 World",
        style({ fontSize: 48 }),
        1000,
        true,
      );
      // "Hello " with its space, which `pre` keeps in the line.
      const hello = layoutText(
        "Hello ",
        style({ fontSize: 48, whiteSpace: "pre" }),
        1000,
      );
      const [emoji] = result.emoji;
      expect(emoji).toMatchObject({ grapheme: "🌍", size: 48 });
      expect(emoji!.x).toBeCloseTo(hello.width, 2);
      const baseline = result.segments[0]!.y;
      expect(emoji!.baseline).toBe(baseline);
      expect(emoji!.y + 48).toBeCloseTo(baseline + 4.8, 4);
    });

    it("breaks around an emoji as Chrome does", () => {
      const result = layoutText(
        "Done 🎉! ok",
        style({ fontSize: 20 }),
        60,
        true,
      );
      expect(result.segments.map((s) => s.text)).toEqual(["Done", "🎉! ok"]);
    });
  });
});

// Yoga measures a text node at whatever widths its algorithm needs, while the
// text is drawn at the node's final width; the node must be as tall as the
// lines drawn (#166).
describe.skipIf(!HAS_NATIVE_DEPS)(
  "text measured and drawn at one width",
  () => {
    beforeAll(async () => {
      ensureFontsRegistered(await loadFonts());
    });

    const textNodes = (node: LayoutNode): LayoutNode[] =>
      node.type === "text" ? [node] : node.children.flatMap(textNodes);

    /** Lay `element` out, and check every text node against its drawn lines. */
    async function layOut(element: React.ReactElement) {
      const { tree } = await buildLayoutTree(
        // A column that doesn't stretch its children, so that boxes keep the
        // height their text gives them.
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            fontFamily: "Liberation Sans",
          }}
        >
          {element}
        </div>,
        400,
        400,
        false,
        ["Liberation Sans"],
      );
      const nodes = textNodes(tree);
      for (const node of nodes) {
        // What drawing lays out: the text at the node's width.
        const drawn = layoutText(node.textContent!, node.style, node.width);
        expect(node.textLayout?.segments.map((s) => s.text)).toEqual(
          drawn.segments.map((s) => s.text),
        );
        const lineHeight = drawn.segments[0]!.height;
        expect(drawn.height).toBe(
          Math.ceil(drawn.segments.length * lineHeight),
        );
        expect(node.height).toBe(drawn.height);
      }
      return nodes;
    }

    it.each([
      // The issue's example: measured at 300px (the flex basis), where every
      // word fits, and drawn at 80px, where one doesn't.
      ["A supercalifragilisticexpialidocious word here", 4],
      // The same with words that fit at both widths, so both lay the text out
      // natively.
      ["A quick brown fox jumps over here", 6],
    ])("sizes shrunk text for its final width: %s", async (text, lines) => {
      const [node] = await layOut(
        <div style={{ display: "flex", width: 300 }}>
          <div style={{ fontSize: 20 }}>{text}</div>
          <div style={{ width: 220, height: 20, flexShrink: 0 }} />
        </div>,
      );
      expect(node!.width).toBe(80);
      expect(node!.textLayout!.segments).toHaveLength(lines);
    });

    it("breaks text at the fractional width Yoga gives it, as Chrome does", async () => {
      // Three columns of 98.33px, too narrow for "Hello world" (98.93px):
      // Chrome wraps it to two lines. Yoga rounds boxes to whole pixels, and
      // a text box out to 99px, where the text would fit on one; text boxes
      // keep the width the text was measured at instead.
      const nodes = await layOut(
        <div style={{ display: "flex", width: 295, alignItems: "flex-start" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ fontSize: 20, flexGrow: 1, flexBasis: 0 }}>
              Hello world
            </div>
          ))}
        </div>,
      );
      for (const node of nodes) {
        expect(node.width).toBeCloseTo(295 / 3, 4);
        expect(node.textLayout!.segments.map((s) => s.text)).toEqual([
          "Hello",
          "world",
        ]);
      }
      // Text is still placed on whole pixels, as before.
      expect(nodes.map((node) => node.x)).toEqual([0, 0, 0]);
    });

    it("sizes text squeezed to no width by every line drawn", async () => {
      const [node] = await layOut(
        <div style={{ display: "flex", width: 100 }}>
          <div style={{ fontSize: 20 }}>A quick brown fox</div>
          <div style={{ width: 100, height: 20, flexShrink: 0 }} />
        </div>,
      );
      expect(node!.width).toBe(0);
      expect(node!.textLayout!.segments).toHaveLength(4);
    });

    it("falls back to Yoga's own layout when the text doesn't settle", async () => {
      // In a wrapping column of fixed height, a text's height decides which
      // column the next item goes in, and with it the widths: each height
      // drawn moves the layout on to widths it doesn't fit.
      // (A half of the column around it, which has no width of its own.)
      const element = (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            fontFamily: "Liberation Sans",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexWrap: "wrap",
              height: 40,
              width: "50%",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 200,
                fontSize: 20,
              }}
            >
              dog word word here
            </div>
            <div style={{ display: "flex", flexGrow: 1, fontSize: 14 }}>
              jumps quick quick quick A quick
            </div>
          </div>
        </div>
      );
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const layOutWith = (debug: boolean) =>
          buildLayoutTree(element, 400, 400, false, ["Liberation Sans"], {
            imageCache: new Map(),
            debug,
          });
        const { tree } = await layOutWith(false);
        expect(warn).not.toHaveBeenCalled();
        await layOutWith(true);
        expect(warn).toHaveBeenCalledTimes(1);
        // Whatever the boxes, the text is drawn as laid out at their widths.
        for (const node of textNodes(tree)) {
          expect(node.textLayout?.segments.map((s) => s.text)).toEqual(
            layoutText(node.textContent!, node.style, node.width).segments.map(
              (s) => s.text,
            ),
          );
        }
      } finally {
        warn.mockRestore();
      }
    });
  },
);
