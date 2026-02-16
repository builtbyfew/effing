import { describe, test, expect, vi, beforeEach } from "vitest";
import { toCodePoint, getEmojiCode } from "./emoji.ts";

describe("toCodePoint", () => {
  test("basic ASCII char", () => {
    expect(toCodePoint("A")).toBe("41");
  });

  test("BMP emoji (sun ☀)", () => {
    expect(toCodePoint("☀")).toBe("2600");
  });

  test("surrogate pair emoji (😀)", () => {
    expect(toCodePoint("😀")).toBe("1f600");
  });

  test("multi-codepoint sequence (flag 🇳🇱)", () => {
    expect(toCodePoint("🇳🇱")).toBe("1f1f3-1f1f1");
  });
});

describe("getEmojiCode", () => {
  test("strips variation selector U+FE0F when no ZWJ", () => {
    // ☀️ = ☀ (U+2600) + U+FE0F
    expect(getEmojiCode("☀️")).toBe("2600");
  });

  test("preserves ZWJ sequences", () => {
    // 👨‍👩‍👧 = U+1F468 U+200D U+1F469 U+200D U+1F467
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
    const result = getEmojiCode(family);
    expect(result).toContain("200d");
    expect(result).toBe("1f468-200d-1f469-200d-1f467");
  });
});

describe("loadEmoji", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("uses function-based URL for twemoji", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve("<svg>twemoji</svg>"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { loadEmoji } = await import("./emoji.ts");
    const result = await loadEmoji("twemoji", "1f600");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdnjs.cloudflare.com/ajax/libs/twemoji/16.0.1/svg/1f600.svg",
    );
    expect(result).toBe("<svg>twemoji</svg>");
  });

  test("uses string-based URL for openmoji", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve("<svg>openmoji</svg>"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { loadEmoji } = await import("./emoji.ts");
    const result = await loadEmoji("openmoji", "1f600");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn.jsdelivr.net/npm/@svgmoji/openmoji@2.0.0/svg/1F600.svg",
    );
    expect(result).toBe("<svg>openmoji</svg>");
  });

  test("caches results — second call does not re-fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve("<svg>cached</svg>"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { loadEmoji } = await import("./emoji.ts");

    const first = await loadEmoji("twemoji", "2600");
    const second = await loadEmoji("twemoji", "2600");

    expect(first).toBe("<svg>cached</svg>");
    expect(second).toBe("<svg>cached</svg>");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("makeLoadAdditionalAsset", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test('returns base64 data URI for code === "emoji"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve("<svg>smile</svg>"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { makeLoadAdditionalAsset } = await import("./emoji.ts");
    const loader = makeLoadAdditionalAsset("twemoji");
    const result = await loader("emoji", "😀");

    expect(result).toBe(
      "data:image/svg+xml;base64," + btoa("<svg>smile</svg>"),
    );
  });

  test("returns segment as-is for non-emoji codes", async () => {
    const { makeLoadAdditionalAsset } = await import("./emoji.ts");
    const loader = makeLoadAdditionalAsset("twemoji");
    const result = await loader("font", "Inter");

    expect(result).toBe("Inter");
  });
});
