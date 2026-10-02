import LineBreaker from "linebreak";

export type BreakOpportunity = {
  position: number;
  required: boolean;
};

/**
 * UAX #14 class CJ: small kana and the prolonged sound mark, which may start
 * a line in browsers (and in Skia's paragraph) under `line-break: auto`. The
 * `linebreak` package resolves them as NS (strict), which can't.
 */
const CONDITIONAL_JAPANESE_STARTERS =
  /[\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308E\u3095\u3096\u30A1\u30A3\u30A5\u30A7\u30A9\u30C3\u30E3\u30E5\u30E7\u30EE\u30F5\u30F6\u30FC\u31F0-\u31FF\uFF67-\uFF70]/g;

/** A katakana letter, of class ID, to resolve CJ as (one UTF-16 unit, too). */
const ID = "\u30A2";

/**
 * Find line-break opportunities in text using UAX #14 algorithm, resolving
 * class CJ as ID as browsers do under `line-break: auto`.
 *
 * @param text - The text to analyze
 * @returns Array of break opportunities with positions and whether they're required (hard breaks)
 */
export function findBreakOpportunities(text: string): BreakOpportunity[] {
  const breaker = new LineBreaker(
    text.replace(CONDITIONAL_JAPANESE_STARTERS, ID),
  );
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
