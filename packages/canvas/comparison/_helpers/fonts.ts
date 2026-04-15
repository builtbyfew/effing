import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontData } from "../../src/types.ts";

export const HAS_NATIVE_DEPS = (() => {
  try {
    require.resolve("@napi-rs/canvas");
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
