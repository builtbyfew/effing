import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FontData } from "../../../types.ts";

export const HAS_NATIVE_DEPS = (() => {
  try {
    require.resolve("@napi-rs/canvas");
    return true;
  } catch {
    return false;
  }
})();

const CDNFONTS = "https://fonts.cdnfonts.com/s/277";
const fontCache = new Map<string, Promise<Buffer>>();

export function fetchFont(url: string): Promise<Buffer> {
  let p = fontCache.get(url);
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout(2000) }).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch font: ${url}`);
      return r.arrayBuffer().then((ab) => Buffer.from(ab));
    });
    fontCache.set(url, p);
  }
  return p;
}

export async function loadLocalFonts(): Promise<FontData[] | null> {
  const FONT_DIR = "/usr/share/fonts/truetype/liberation";
  const mappings: {
    path: string;
    weight: FontData["weight"];
    style: FontData["style"];
  }[] = [
    {
      path: join(FONT_DIR, "LiberationSans-Regular.ttf"),
      weight: 400,
      style: "normal",
    },
    {
      path: join(FONT_DIR, "LiberationSans-Bold.ttf"),
      weight: 700,
      style: "normal",
    },
    {
      path: join(FONT_DIR, "LiberationSans-Italic.ttf"),
      weight: 400,
      style: "italic",
    },
  ];

  if (!mappings.every((m) => existsSync(m.path))) return null;

  return Promise.all(
    mappings.map(async (m) => ({
      name: "Liberation Sans",
      data: await readFile(m.path),
      weight: m.weight,
      style: m.style,
    })),
  );
}

export async function loadFonts(): Promise<{
  fonts: FontData[];
  remote: boolean;
}> {
  try {
    const fonts = await Promise.all([
      fetchFont(`${CDNFONTS}/LiberationSans-Regular.woff`).then((data) => ({
        name: "Liberation Sans",
        data,
        weight: 400 as const,
        style: "normal" as const,
      })),
      fetchFont(`${CDNFONTS}/LiberationSans-Bold.woff`).then((data) => ({
        name: "Liberation Sans",
        data,
        weight: 700 as const,
        style: "normal" as const,
      })),
      fetchFont(`${CDNFONTS}/LiberationSans-Italic.woff`).then((data) => ({
        name: "Liberation Sans",
        data,
        weight: 400 as const,
        style: "italic" as const,
      })),
    ]);
    return { fonts, remote: true };
  } catch {
    const local = await loadLocalFonts();
    if (local) return { fonts: local, remote: false };
    throw new Error(
      "Cannot load fonts: network unavailable and no local Liberation Sans found",
    );
  }
}
