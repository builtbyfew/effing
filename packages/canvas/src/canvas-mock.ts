import { vi } from "vitest";

type MockParagraphStyle = {
  letterSpacing?: number;
  lineHeight?: number | null;
  textAlign?: string;
  noWrap?: boolean;
  maxLines?: number;
  ellipsis?: string;
  keepTrailingWhitespace?: boolean;
  wordBreak?: string;
  overflowWrap?: string;
};

type MockPlaceholder = {
  width: number;
  height: number;
  baselineOffset?: number | null;
  lineBreak?: "box" | "emoji" | null;
};

/**
 * Mock of `@effing/skia/extensions`, to pair with `createCanvasMock`. Its
 * `Paragraph` lays text out the way the canvas mock measures it: 8px per
 * character, ascent 12, descent 4 and no line gap, breaking greedily at spaces and leaving
 * a word wider than the line to overflow it. As the real one, it rounds the
 * line height to 1/64px and places baselines by Chrome's half-leading. A placeholder is one character
 * (U+FFFC) of its own width, its baseline on the line's.
 */
export function createExtensionsMock() {
  class Paragraph {
    readonly text: string;
    readonly placeholders: MockPlaceholder[];

    constructor(
      content: string | readonly (string | MockPlaceholder)[],
      readonly style: MockParagraphStyle,
    ) {
      const items = typeof content === "string" ? [content] : content;
      this.text = items
        .map((item) => (typeof item === "string" ? item : "\uFFFC"))
        .join("");
      this.placeholders = items.filter(
        (item): item is MockPlaceholder => typeof item !== "string",
      );
    }

    layout(width: number) {
      const { text, style, placeholders } = this;
      const charWidth = 8 + (style.letterSpacing ?? 0);
      const lineHeight = Math.round((style.lineHeight ?? 16) * 64) / 64;
      // Chrome's half-leading: the half of the leading above the text, halved
      // in 1/64px and floored to whole pixels.
      const baselineInBox =
        12 + Math.floor(Math.trunc(((lineHeight - 16) * 64) / 2) / 64);
      const bounded = width > 0 && Number.isFinite(width);
      // Each character's advance, and where each placeholder is.
      const advances: number[] = [];
      const placeholderAt = new Map<number, number>();
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "\uFFFC") {
          placeholderAt.set(i, placeholderAt.size);
          advances.push(placeholders[placeholderAt.size - 1]!.width);
        } else {
          advances.push(charWidth);
        }
      }
      const measure = (start: number, end: number) =>
        advances.slice(start, end).reduce((w, a) => w + a, 0);
      const fits = (start: number, end: number) =>
        !bounded || measure(start, end) <= width;

      // [start, end) ranges of the text, trailing spaces excluded (unless
      // kept before a hard break).
      const ranges: { start: number; end: number; hardBreak: boolean }[] = [];
      let longestWord = 0;
      let offset = 0;
      for (const hardLine of text.split("\n")) {
        let start = offset;
        let end = offset;
        for (const word of hardLine.matchAll(/\S+/g)) {
          const wordStart = offset + word.index;
          const wordEnd = wordStart + word[0].length;
          longestWord = Math.max(longestWord, measure(wordStart, wordEnd));
          if (!style.noWrap && end > start && !fits(start, wordEnd)) {
            ranges.push({ start, end, hardBreak: false });
            start = wordStart;
          }
          end = wordEnd;
        }
        if (style.keepTrailingWhitespace) end = offset + hardLine.length;
        ranges.push({ start, end, hardBreak: true });
        offset += hardLine.length + 1;
      }

      const didExceedMaxLines =
        !!style.maxLines && ranges.length > style.maxLines;
      if (didExceedMaxLines) ranges.length = style.maxLines!;

      const lines = ranges.map(({ start, end, hardBreak }, i) => {
        let lineWidth = measure(start, end);
        const truncated =
          !!style.ellipsis &&
          ((didExceedMaxLines && i === ranges.length - 1) ||
            (!!style.noWrap && !fits(start, end)));
        if (truncated) {
          // Room for the ellipsis, which the line's width includes.
          const room = (e: number) =>
            !bounded || measure(start, e) + charWidth <= width;
          while (end > start && !room(end)) end--;
          lineWidth = measure(start, end) + charWidth;
        }
        const slack = bounded ? Math.max(0, width - lineWidth) : 0;
        const left =
          style.textAlign === "center"
            ? slack / 2
            : style.textAlign === "right" || style.textAlign === "end"
              ? slack
              : 0;
        return {
          left,
          width: lineWidth,
          baseline: i * lineHeight + baselineInBox,
          startIndex: start,
          endIndex: end,
          hardBreak,
        };
      });

      const boxes = placeholders.map(() => null as unknown);
      for (const [index, n] of placeholderAt) {
        const line = lines.findIndex(
          (l) => l.startIndex <= index && index < l.endIndex,
        );
        if (line < 0) continue;
        const { left, startIndex, baseline } = lines[line]!;
        const { width, height, baselineOffset } = placeholders[n]!;
        boxes[n] = {
          x: left + measure(startIndex, index),
          y: baseline - (baselineOffset ?? height),
          width,
          height,
          line,
        };
      }

      const longestLine = lines.reduce((w, l) => Math.max(w, l.width), 0);
      return {
        height: lines.length * lineHeight,
        longestLine,
        minIntrinsicWidth: style.noWrap ? longestLine : longestWord,
        maxIntrinsicWidth: measure(0, text.length),
        didExceedMaxLines,
        lineHeight,
        ascent: 12,
        descent: 4,
        lineGap: 0,
        lines,
        placeholders: boxes,
      };
    }
  }

  return {
    Paragraph,
    fillParagraph: vi.fn(),
    strokeParagraph: vi.fn(),
    beginGroup: vi.fn(),
    endGroup: vi.fn(),
    fontRevision: () => 0,
  };
}

export function createCanvasMock() {
  const mockCtx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt" as string,
    lineJoin: "miter" as string,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "transparent",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    canvas: { width: 200, height: 200 },
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    filter: "none",
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    reset: vi.fn(),
    setTransform: vi.fn(),
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
    })),
  };

  const mockCanvas = {
    width: 200,
    height: 200,
    getContext: vi.fn(() => mockCtx),
  };

  return {
    createCanvas: vi.fn(() => mockCanvas),
    Canvas: vi.fn(),
    Path2D: vi.fn(() => ({
      rect: vi.fn(),
      roundRect: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      addPath: vi.fn(),
    })),
    GlobalFonts: {
      register: vi.fn(),
      registerFromPath: vi.fn(),
      families: [],
    },
    loadImage: vi.fn(async () => ({
      width: 100,
      height: 100,
    })),
    Image: vi.fn(),
    LottieAnimation: {
      loadFromData: vi.fn(),
    },
  };
}
