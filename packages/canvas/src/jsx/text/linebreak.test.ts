import { describe, expect, it } from "vitest";

import { findBreakOpportunities } from "./linebreak.ts";

const positions = (text: string) =>
  findBreakOpportunities(text).map((opp) => opp.position);

describe("findBreakOpportunities", () => {
  it("allows a break before small kana and ー, as under line-break: auto", () => {
    // UAX #14 class CJ, which the `linebreak` package resolves as NS.
    expect(positions("ディズニー")).toEqual([1, 2, 3, 4, 5]);
  });

  it("allows a break before an astral small kana, not inside it", () => {
    // U+1B150 HIRAGANA LETTER SMALL WI, two UTF-16 units.
    const text = "あ\u{1B150}い";
    expect(text).toHaveLength(4);
    expect(positions(text)).toEqual([1, 3, 4]);
  });
});
