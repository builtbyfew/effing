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
