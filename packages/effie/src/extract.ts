import type { EffieData, EffieSources, EffieWebUrl } from "./types";

/**
 * Options for extracting sources from EffieData
 */
export type ExtractSourcesOptions = {
  /** Include data URLs in the result (default: false) */
  includeDataUrls?: boolean;
};

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
  const { includeDataUrls = false } = options;
  const sources = new Set<string>();

  const addSource = (src: string) => {
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

    sources.add(src);
  };

  // Cover image
  addSource(effieData.cover);

  // Global background
  if (effieData.background.type !== "color") {
    addSource(effieData.background.source);
  }

  // Global audio
  if (effieData.audio) {
    addSource(effieData.audio.source);
  }

  // Segments
  for (const segment of effieData.segments) {
    // Segment background
    if (segment.background && segment.background.type !== "color") {
      addSource(segment.background.source);
    }
    // Segment audio
    if (segment.audio) {
      addSource(segment.audio.source);
    }
    // Layers
    for (const layer of segment.layers) {
      addSource(layer.source);
    }
  }

  return Array.from(sources);
}
