import type { FontData } from "@effing/satori";

export type { FontData };

export type Font = () => Promise<FontData>;

/**
 * Load multiple fonts in parallel
 */
export async function loadFonts(fonts: Font[]): Promise<FontData[]> {
  return Promise.all(fonts.map((font) => font()));
}

// Font cache to avoid re-fetching
const fontCache = new Map<string, Promise<ArrayBuffer>>();

async function fetchFont(url: string): Promise<ArrayBuffer> {
  if (!fontCache.has(url)) {
    fontCache.set(
      url,
      fetch(url).then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
        return res.arrayBuffer();
      }),
    );
  }
  return fontCache.get(url)!;
}

// Google Fonts URLs - fetched from Google Fonts CSS2 API
const GOOGLE_FONTS_BASE = "https://fonts.gstatic.com/s";

/**
 * Inter Semi-Bold (600)
 */
export const interSemiBold: Font = async () => ({
  name: "Inter",
  data: await fetchFont(
    `${GOOGLE_FONTS_BASE}/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf`,
  ),
  weight: 600,
  style: "normal",
});

/**
 * Inter Bold (700)
 */
export const interBold: Font = async () => ({
  name: "Inter",
  data: await fetchFont(
    `${GOOGLE_FONTS_BASE}/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf`,
  ),
  weight: 700,
  style: "normal",
});

/**
 * Roboto Regular (400)
 */
export const robotoRegular: Font = async () => ({
  name: "Roboto",
  data: await fetchFont(
    `${GOOGLE_FONTS_BASE}/roboto/v50/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf`,
  ),
  weight: 400,
  style: "normal",
});

/**
 * Roboto Bold (700)
 */
export const robotoBold: Font = async () => ({
  name: "Roboto",
  data: await fetchFont(
    `${GOOGLE_FONTS_BASE}/roboto/v50/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf`,
  ),
  weight: 700,
  style: "normal",
});

/**
 * Open Sans Regular (400)
 */
export const openSansRegular: Font = async () => ({
  name: "Open Sans",
  data: await fetchFont(
    `${GOOGLE_FONTS_BASE}/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4n.ttf`,
  ),
  weight: 400,
  style: "normal",
});

/**
 * Open Sans Semi-Bold (600)
 */
export const openSansSemiBold: Font = async () => ({
  name: "Open Sans",
  data: await fetchFont(
    `${GOOGLE_FONTS_BASE}/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsgH1y4n.ttf`,
  ),
  weight: 600,
  style: "normal",
});
