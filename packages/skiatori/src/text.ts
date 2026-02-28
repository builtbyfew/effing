import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { Canvas, FontLibrary } from "skia-canvas";
import type { CanvasRenderingContext2D } from "skia-canvas";
import type { FontData, Style } from "./types.ts";
import { buildFontString, type MeasureTextFn } from "./styles.ts";

// ---------------------------------------------------------------------------
// Font registration
// ---------------------------------------------------------------------------

const registeredFamilies = new Set<string>();

function ensureTempDir(): string {
  const dir = join(tmpdir(), "skiatori-fonts");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function registerFonts(fonts: FontData[]): void {
  // Fast path: skip filesystem entirely when all fonts already registered
  if (
    fonts.every((f) =>
      registeredFamilies.has(
        `${f.name}-${f.weight ?? 400}-${f.style ?? "normal"}`,
      ),
    )
  ) {
    return;
  }

  const tempDir = ensureTempDir();

  for (const font of fonts) {
    const key = `${font.name}-${font.weight ?? 400}-${font.style ?? "normal"}`;
    if (registeredFamilies.has(key)) continue;

    const buf =
      font.data instanceof ArrayBuffer ? Buffer.from(font.data) : font.data;
    const filename = `${key}-${randomBytes(4).toString("hex")}.ttf`;
    const filepath = join(tempDir, filename);
    writeFileSync(filepath, buf);

    FontLibrary.use(font.name, [filepath]);
    registeredFamilies.add(key);
  }
}

// ---------------------------------------------------------------------------
// Measurement canvas (shared, tiny canvas used only for text measurement)
// ---------------------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = new Canvas(1, 1);
    measureCtx = canvas.getContext("2d");
  }
  return measureCtx;
}

export function configureFont(
  ctx: CanvasRenderingContext2D,
  style: Style,
): void {
  ctx.font = buildFontString(style);

  const letterSpacing = style.letterSpacing;
  if (letterSpacing != null) {
    ctx.letterSpacing =
      typeof letterSpacing === "number"
        ? `${letterSpacing}px`
        : String(letterSpacing);
  }

  const wordSpacing = style.wordSpacing;
  if (wordSpacing != null) {
    ctx.wordSpacing =
      typeof wordSpacing === "number"
        ? `${wordSpacing}px`
        : String(wordSpacing);
  }

  const textAlign = style.textAlign;
  if (textAlign != null) {
    ctx.textAlign = String(textAlign) as
      | "center"
      | "end"
      | "left"
      | "right"
      | "start";
  }
}

// ---------------------------------------------------------------------------
// Public measurement function
// ---------------------------------------------------------------------------

export const measureText: MeasureTextFn = (text, style, maxWidth) => {
  const ctx = getMeasureContext();
  configureFont(ctx, style);
  ctx.textWrap = true;

  const metrics = ctx.measureText(text, maxWidth);

  if (metrics.lines && metrics.lines.length > 0) {
    const lastLine = metrics.lines[metrics.lines.length - 1];
    const height = lastLine.y + lastLine.height;
    let width = 0;
    for (const line of metrics.lines) {
      if (line.width > width) width = line.width;
    }
    return { width, height };
  }

  // Fallback for single-line text
  const height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
  return { width: metrics.width, height };
};
