import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontData } from "../../src/types.ts";

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

/**
 * The bundled Liberation Sans under a family name no system font has, for
 * tests that must lay text out in the bundled fonts, whatever the machine:
 * `loadFonts(BUNDLED_SANS)`. A Liberation Sans installed on the system (as
 * fonts-liberation is on Ubuntu) used to shadow fonts registered under its
 * own name (effing-skia#29); since @effing/skia 1.0.10-effing.6 a registered
 * family replaces it, so the name is no longer needed for that, only kept.
 */
export const BUNDLED_SANS = "Bundled Liberation Sans";

/** The bundled Liberation Sans faces, registered as `name`. */
export async function loadFonts(name = "Liberation Sans"): Promise<FontData[]> {
  return Promise.all(
    FONT_VARIANTS.map(({ file, weight, style }) =>
      readFile(join(FONT_DIR, file)).then((data) => ({
        name,
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

/**
 * Fonts loaded with the script fonts, but not in `SCRIPT_FONT_FAMILIES`
 * (SIL Open Font License, see `fonts/OFL-Noto.txt` and
 * `fonts/OFL-Poppins.txt`), under names no system font has (see
 * `BUNDLED_SANS`):
 *
 * - Noto Sans Hebrew, subset to Hebrew, for right-to-left text;
 * - Poppins, subset to Basic Latin, for a font with a line gap other than
 *   Liberation Sans's (100 units of 1000 in its hhea table, 2px at 20px).
 */
export const BUNDLED_HEBREW = "Bundled Noto Sans Hebrew";
export const BUNDLED_POPPINS = "Bundled Poppins";

const MORE_FONTS = [
  [BUNDLED_HEBREW, "NotoSansHebrew-Regular.woff"],
  [BUNDLED_POPPINS, "Poppins-Regular.woff"],
] as const;

export async function loadScriptFonts(): Promise<FontData[]> {
  return Promise.all(
    [...SCRIPT_FONTS, ...MORE_FONTS].map(([name, file]) =>
      readFile(join(FONT_DIR, file)).then((data) => ({
        name,
        data,
        weight: 400 as const,
        style: "normal" as const,
      })),
    ),
  );
}
