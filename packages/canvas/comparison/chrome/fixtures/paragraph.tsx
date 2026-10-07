import type React from "react";
import type { ChromeFixture, Transcribed } from "../fixture.ts";

/**
 * Text in a box `width` wide (`id="p"`), at the top left of a 400×400
 * frame, as `layoutText(text, style, width)` lays it out: 20px Liberation
 * Sans unless `style` says otherwise. The box is a column, across which
 * Chrome stretches the text's anonymous flex item, so that `textAlign`
 * aligns its lines in the box as canvas does.
 */
export function paragraph(
  name: string,
  text: React.ReactNode,
  style: React.CSSProperties,
  width: number,
  transcribed?: Transcribed["p"],
  rest: Partial<ChromeFixture> = {},
): ChromeFixture {
  return {
    name,
    width: 400,
    height: 400,
    element: (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          fontFamily: "Liberation Sans",
          fontSize: 20,
        }}
      >
        <div
          id="p"
          style={{ display: "flex", flexDirection: "column", width, ...style }}
        >
          {text}
        </div>
      </div>
    ),
    transcribed: transcribed && { p: transcribed },
    ...rest,
  };
}

/** Lines of these texts, and nothing else of them. */
export const texts = (lines: readonly string[]) => ({
  lines: lines.map((text) => ({ text })),
});
