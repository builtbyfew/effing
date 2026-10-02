import { vi } from "vitest";

type MockParagraphStyle = {
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: string;
  noWrap?: boolean;
  maxLines?: number;
  ellipsis?: string;
};

/**
 * Mock of `@effing/skia/extensions`, to pair with `createCanvasMock`. Its
 * `Paragraph` lays text out the way the canvas mock measures it: 8px per
 * character, ascent 12 and descent 4, breaking greedily at spaces.
 */
export function createExtensionsMock() {
  class Paragraph {
    constructor(
      readonly text: string,
      readonly style: MockParagraphStyle,
    ) {}

    layout(width: number) {
      const { text, style } = this;
      const charWidth = 8 + (style.letterSpacing ?? 0);
      const lineHeight = style.lineHeight || 16;
      const bounded = width > 0 && Number.isFinite(width);
      const fits = (chars: number) => !bounded || chars * charWidth <= width;

      // [start, end) ranges of the text, trailing spaces excluded.
      const ranges: { start: number; end: number; hardBreak: boolean }[] = [];
      let longestWord = 0;
      let offset = 0;
      for (const hardLine of text.split("\n")) {
        let start = offset;
        let end = offset;
        for (const word of hardLine.matchAll(/\S+/g)) {
          const wordStart = offset + word.index;
          const wordEnd = wordStart + word[0].length;
          longestWord = Math.max(longestWord, word[0].length);
          if (!style.noWrap && end > start && !fits(wordEnd - start)) {
            ranges.push({ start, end, hardBreak: false });
            start = wordStart;
          }
          end = wordEnd;
        }
        ranges.push({ start, end, hardBreak: true });
        offset += hardLine.length + 1;
      }

      const didExceedMaxLines =
        !!style.maxLines && ranges.length > style.maxLines;
      if (didExceedMaxLines) ranges.length = style.maxLines!;

      const lines = ranges.map(({ start, end, hardBreak }, i) => {
        let chars = end - start;
        const truncated =
          !!style.ellipsis &&
          ((didExceedMaxLines && i === ranges.length - 1) ||
            (!!style.noWrap && !fits(chars)));
        if (truncated) {
          // Room for the ellipsis, which the line's width includes.
          while (chars > 0 && !fits(chars + 1)) chars--;
          end = start + chars;
          chars += 1;
        }
        const lineWidth = chars * charWidth;
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
          baseline: i * lineHeight + (lineHeight + 12 - 4) / 2,
          startIndex: start,
          endIndex: end,
          hardBreak,
        };
      });
      const longestLine = lines.reduce((w, l) => Math.max(w, l.width), 0);
      return {
        height: lines.length * lineHeight,
        longestLine,
        minIntrinsicWidth: style.noWrap ? longestLine : longestWord * charWidth,
        maxIntrinsicWidth: text.length * charWidth,
        didExceedMaxLines,
        lineHeight,
        ascent: 12,
        descent: 4,
        lines,
      };
    }
  }

  return {
    Paragraph,
    fillParagraph: vi.fn(),
    strokeParagraph: vi.fn(),
    beginGroup: vi.fn(),
    endGroup: vi.fn(),
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
