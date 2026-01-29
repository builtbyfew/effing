import type { EffieData, EffieSources, EffieWebUrl } from "./types";

/**
 * Source type for extraction
 */
export type EffieSourceType = "image" | "video" | "audio" | "animation";

/**
 * A source with its type information
 */
export type EffieSourceWithType = {
  url: string;
  type: EffieSourceType;
};

/**
 * Options for extracting sources from EffieData
 */
export type ExtractSourcesOptions = {
  /** Include data URLs in the result (default: false) */
  includeDataUrls?: boolean;
};

/**
 * Extract all source URLs from an EffieData composition with their types.
 * Resolves #references and deduplicates results.
 *
 * @param effieData - The Effie composition
 * @param options - Extraction options
 * @returns Array of unique source URLs with their types
 *
 * @example
 * ```ts
 * const sources = extractEffieSourcesWithTypes(effieData);
 * // [{ url: "https://cdn.example.com/bg.jpg", type: "image" }, ...]
 * ```
 */
export function extractEffieSourcesWithTypes<U extends string = EffieWebUrl>(
  effieData: EffieData<EffieSources<U>, U>,
  options: ExtractSourcesOptions = {},
): EffieSourceWithType[] {
  const { includeDataUrls = false } = options;
  // Map from URL to type (first type wins for deduplication)
  const sourceMap = new Map<string, EffieSourceType>();

  const addSource = (src: string, type: EffieSourceType) => {
    // Resolve #references
    if (src.startsWith("#")) {
      const name = src.slice(1);
      if (effieData.sources?.[name]) {
        src = effieData.sources[name];
      } else {
        return; // Reference not found, skip
      }
    }

    // Filter data URLs unless explicitly asked to include
    if (!includeDataUrls && src.startsWith("data:")) {
      return;
    }

    // Only add if not already present (first type wins)
    if (!sourceMap.has(src)) {
      sourceMap.set(src, type);
    }
  };

  // Cover image
  addSource(effieData.cover, "image");

  // Global background
  if (effieData.background.type === "image") {
    addSource(effieData.background.source, "image");
  } else if (effieData.background.type === "video") {
    addSource(effieData.background.source, "video");
  }

  // Global audio
  if (effieData.audio) {
    addSource(effieData.audio.source, "audio");
  }

  // Segments
  for (const segment of effieData.segments) {
    // Segment background
    if (segment.background) {
      if (segment.background.type === "image") {
        addSource(segment.background.source, "image");
      } else if (segment.background.type === "video") {
        addSource(segment.background.source, "video");
      }
    }
    // Segment audio
    if (segment.audio) {
      addSource(segment.audio.source, "audio");
    }
    // Layers
    for (const layer of segment.layers) {
      addSource(layer.source, layer.type);
    }
  }

  return Array.from(sourceMap.entries()).map(([url, type]) => ({ url, type }));
}

/**
 * Extract all source URLs from an EffieData composition.
 * Resolves #references and deduplicates results.
 *
 * @param effieData - The Effie composition
 * @param options - Extraction options
 * @returns Array of unique source URLs
 *
 * @example
 * ```ts
 * const sources = extractEffieSources(effieData);
 * // ["https://cdn.example.com/bg.jpg", "https://api.example.com/annie/hero", ...]
 * ```
 */
export function extractEffieSources<U extends string = EffieWebUrl>(
  effieData: EffieData<EffieSources<U>, U>,
  options: ExtractSourcesOptions = {},
): string[] {
  return extractEffieSourcesWithTypes(effieData, options).map((s) => s.url);
}
