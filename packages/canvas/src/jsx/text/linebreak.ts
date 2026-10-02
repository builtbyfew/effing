import LineBreaker from "linebreak";

export type BreakOpportunity = {
  position: number;
  required: boolean;
};

/**
 * Find line-break opportunities in text using UAX #14 algorithm.
 *
 * @param text - The text to analyze
 * @returns Array of break opportunities with positions and whether they're required (hard breaks)
 */
export function findBreakOpportunities(text: string): BreakOpportunity[] {
  const breaker = new LineBreaker(text);
  const opportunities: BreakOpportunity[] = [];

  let bk = breaker.nextBreak();
  while (bk) {
    opportunities.push({
      position: bk.position,
      required: bk.required ?? false,
    });
    bk = breaker.nextBreak();
  }

  return opportunities;
}

/** Splits text into grapheme clusters, the units a word may be broken into. */
export const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/** Positions in `text` between two grapheme clusters. */
export function findGraphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>();
  for (const { index } of graphemeSegmenter.segment(text)) {
    boundaries.add(index);
  }
  boundaries.add(text.length);
  return boundaries;
}

/**
 * Positions in `text` between two words, by ICU's word segmentation. For
 * scripts written without spaces (Thai, Lao, Khmer, Burmese) these are where
 * lines may break, from a dictionary that UAX #14 alone doesn't have; Skia's
 * paragraph breaks lines there, and the `linebreak` package doesn't.
 */
export function findWordJunctions(text: string): Set<number> {
  const junctions = new Set<number>();
  let previousIsWord = false;
  for (const { index, isWordLike } of wordSegmenter.segment(text)) {
    if (previousIsWord && isWordLike) junctions.add(index);
    previousIsWord = !!isWordLike;
  }
  return junctions;
}
