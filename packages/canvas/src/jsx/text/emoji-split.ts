import { isEmoji } from "../language.ts";

export type TextRun =
  | { kind: "text"; text: string; x: number; width: number }
  | { kind: "emoji"; char: string; x: number; width: number };

/**
 * Split a text string into runs of plain text and individual emoji characters.
 * Uses Intl.Segmenter for correct grapheme cluster handling (multi-codepoint emoji).
 */
export function splitTextIntoRuns(
  text: string,
  measureText: (text: string) => number,
  emojiSize: number,
  letterSpacing: number = 0,
): TextRun[] {
  const runs: TextRun[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let currentText = "";
  let currentGraphemeCount = 0;
  let currentX = 0;
  let textStartX = 0;

  for (const { segment } of segmenter.segment(text)) {
    if (isEmojiGrapheme(segment)) {
      // Flush accumulated text
      if (currentText) {
        const textWidth = measureText(currentText);
        runs.push({
          kind: "text",
          text: currentText,
          x: textStartX,
          width: textWidth + letterSpacing * currentGraphemeCount,
        });
        currentX =
          textStartX + textWidth + letterSpacing * currentGraphemeCount;
        currentText = "";
        currentGraphemeCount = 0;
      }
      runs.push({
        kind: "emoji",
        char: segment,
        x: currentX,
        width: emojiSize,
      });
      currentX += emojiSize + letterSpacing;
      textStartX = currentX;
    } else {
      if (!currentText) textStartX = currentX;
      currentText += segment;
      currentGraphemeCount++;
    }
  }

  // Flush remaining text
  if (currentText) {
    const textWidth = measureText(currentText);
    runs.push({
      kind: "text",
      text: currentText,
      x: textStartX,
      width: textWidth + letterSpacing * currentGraphemeCount,
    });
  }

  return runs;
}

/**
 * Check if a grapheme cluster is an emoji.
 * Checks the first code point of the grapheme.
 */
function isEmojiGrapheme(grapheme: string): boolean {
  for (const char of grapheme) {
    if (isEmoji(char)) return true;
  }
  return false;
}
