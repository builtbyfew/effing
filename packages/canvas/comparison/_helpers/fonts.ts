import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontData } from "../../src/types.ts";

export const HAS_NATIVE_DEPS = (() => {
  try {
    require.resolve("@effing/skia");
    return true;
  } catch {
    return false;
  }
})();

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, "fonts");

const FONT_VARIANTS = [
  {
    file: "LiberationSans-Regular.woff",
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    file: "LiberationSans-Bold.woff",
    weight: 700 as const,
    style: "normal" as const,
  },
  {
    file: "LiberationSans-Italic.woff",
    weight: 400 as const,
    style: "italic" as const,
  },
] as const;

export async function loadFonts(): Promise<FontData[]> {
  return Promise.all(
    FONT_VARIANTS.map(({ file, weight, style }) =>
      readFile(join(FONT_DIR, file)).then((data) => ({
        name: "Liberation Sans",
        data,
        weight,
        style,
      })),
    ),
  );
}

/**
 * Fonts for scripts written without spaces between words, which Skia breaks
 * from ICU's dictionaries: Noto Sans subset to Thai, Lao and Myanmar (SIL
 * Open Font License, see `fonts/OFL-Noto.txt`). Bundled so that tests of them
 * don't depend on the system's fallback fonts. List them after the text's
 * own font, in `SCRIPT_FONT_FAMILIES`.
 */
const SCRIPT_FONTS = [
  ["Noto Sans Thai", "NotoSansThai-Regular.woff"],
  ["Noto Sans Lao", "NotoSansLao-Regular.woff"],
  ["Noto Sans Myanmar", "NotoSansMyanmar-Regular.woff"],
] as const;

export const SCRIPT_FONT_FAMILIES = SCRIPT_FONTS.map(([name]) => name).join(
  ", ",
);

export async function loadScriptFonts(): Promise<FontData[]> {
  return Promise.all(
    SCRIPT_FONTS.map(([name, file]) =>
      readFile(join(FONT_DIR, file)).then((data) => ({
        name,
        data,
        weight: 400 as const,
        style: "normal" as const,
      })),
    ),
  );
}
