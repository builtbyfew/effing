import { describe, expect, it } from "vitest";

import { collapseWhiteSpace, isWhiteSpaceOnly } from "./white-space.ts";

describe("collapseWhiteSpace", () => {
  it.each([
    ["a\nb", "a b"],
    ["a  \n  b", "a b"],
    ["a\n\n\nb", "a b"],
    ["a \n \n b", "a b"],
    ["a\r\nb", "a b"],
    ["a\rb", "a b"],
    ["a\tb\t\tc", "a b c"],
    ["a     b", "a b"],
    ["   Hello world   ", "Hello world"],
    ["\n  Hello\n  world\n", "Hello world"],
    ["", ""],
    [" \t\n ", ""],
    ["东京\n大阪", "东京 大阪"],
  ])("collapses %j to %j under normal and nowrap", (text, expected) => {
    expect(collapseWhiteSpace(text, "normal")).toBe(expected);
    expect(collapseWhiteSpace(text, "nowrap")).toBe(expected);
    expect(collapseWhiteSpace(text, undefined)).toBe(expected);
  });

  it.each([
    ["a\nb", "a\nb"],
    ["a  \n  b", "a\nb"],
    ["a\n\n\nb", "a\n\n\nb"],
    ["a \n \n b", "a\n\nb"],
    ["a\r\nb", "a\nb"],
    ["a\rb", "a b"],
    ["a\tb\t\tc", "a b c"],
    ["a     b", "a b"],
    ["   Hello world   ", "Hello world"],
    ["\n  Hello", "\nHello"],
    ["Hello \n ", "Hello"],
    ["a\n\n", "a\n"],
    ["a\r\n", "a"],
  ])("collapses %j to %j under pre-line", (text, expected) => {
    expect(collapseWhiteSpace(text, "pre-line")).toBe(expected);
  });

  it.each(["pre", "pre-wrap"] as const)("keeps the text under %s", (ws) => {
    for (const text of ["a  \n  b", " a\tb ", "a \n "]) {
      expect(collapseWhiteSpace(text, ws)).toBe(text);
    }
  });

  // Chrome breaks the line at a CRLF as at a newline. It lays a lone CR out
  // with no width and no break opportunity, as the paragraph does, but the
  // letters either side of it don't kern, so it's kept.
  it.each(["pre", "pre-wrap"] as const)(
    "makes a CRLF a newline and keeps a lone CR under %s",
    (ws) => {
      expect(collapseWhiteSpace("a  \r\n  b", ws)).toBe("a  \n  b");
      expect(collapseWhiteSpace("a\rb", ws)).toBe("a\rb");
      expect(collapseWhiteSpace("a\r\rb\r", ws)).toBe("a\r\rb\r");
      // A lone CR, then a CRLF: the CR goes with the newline after it, which
      // it would end at no width anyway.
      expect(collapseWhiteSpace("a\r\r\nb", ws)).toBe("a\nb");
    },
  );

  // Chrome gives "a\n" one line, and "a\n\n" two.
  it.each(["pre", "pre-wrap"] as const)(
    "drops a segment break at the end of the text under %s",
    (ws) => {
      expect(collapseWhiteSpace("a  \n", ws)).toBe("a  ");
      expect(collapseWhiteSpace("a\r\n", ws)).toBe("a");
      expect(collapseWhiteSpace("a\n\n", ws)).toBe("a\n");
    },
  );

  it("keeps white space other than spaces, tabs and segment breaks", () => {
    expect(collapseWhiteSpace("a\u00a0\u00a0 b", "normal")).toBe(
      "a\u00a0\u00a0 b",
    );
    expect(collapseWhiteSpace("\u3000a\u2003", "normal")).toBe("\u3000a\u2003");
  });

  it("keeps the emoji and the text around them", () => {
    expect(collapseWhiteSpace("Hi \n 🌍 \t there", "normal")).toBe(
      "Hi 🌍 there",
    );
    expect(collapseWhiteSpace("Hi \n 🌍 \t there", "pre-line")).toBe(
      "Hi\n🌍 there",
    );
  });

  it("returns text with nothing to collapse as it is", () => {
    const text = "The quick brown fox";
    expect(collapseWhiteSpace(text, "normal")).toBe(text);
  });
});

// The pieces of text between <br>s, each <br> a forced break.
describe("collapseWhiteSpace: <br>", () => {
  const ALL = ["normal", "nowrap", "pre-line", "pre", "pre-wrap"] as const;

  it.each(ALL)("breaks at every <br> under %s", (ws) => {
    expect(collapseWhiteSpace(["a", "b"], ws)).toBe("a\nb");
    expect(collapseWhiteSpace(["a", "", "b"], ws)).toBe("a\n\nb");
    expect(collapseWhiteSpace(["", "a"], ws)).toBe("\na");
    expect(collapseWhiteSpace(["a"], ws)).toBe("a");
  });

  // Only one break that ends the text is dropped, as for a newline.
  it.each(ALL)("starts no line after a final <br> under %s", (ws) => {
    expect(collapseWhiteSpace(["a", ""], ws)).toBe("a");
    expect(collapseWhiteSpace(["a", "", ""], ws)).toBe("a\n");
    expect(collapseWhiteSpace(["", ""], ws)).toBe("");
  });

  it.each(["normal", "nowrap", "pre-line"] as const)(
    "removes the spaces around a <br> under %s",
    (ws) => {
      expect(collapseWhiteSpace(["a \t", " \tb "], ws)).toBe("a\nb");
      expect(collapseWhiteSpace([" ", " "], ws)).toBe("");
    },
  );

  it.each(["normal", "nowrap"] as const)(
    "removes the newlines around a <br> under %s",
    (ws) => {
      expect(collapseWhiteSpace(["a\n", "\nb"], ws)).toBe("a\nb");
      expect(collapseWhiteSpace(["a \n b", "c"], ws)).toBe("a b\nc");
    },
  );

  // Chrome gives "a\n<br>b" an empty line between "a" and "b".
  it.each(["pre-line", "pre", "pre-wrap"] as const)(
    "keeps a newline next to a <br> a break of its own under %s",
    (ws) => {
      expect(collapseWhiteSpace(["a\n", "b"], ws)).toBe("a\n\nb");
      expect(collapseWhiteSpace(["a", "\nb"], ws)).toBe("a\n\nb");
      expect(collapseWhiteSpace(["a\n", ""], ws)).toBe("a\n");
    },
  );

  it.each(["pre", "pre-wrap"] as const)(
    "keeps the spaces around a <br> under %s",
    (ws) => {
      expect(collapseWhiteSpace(["a ", " b"], ws)).toBe("a \n b");
    },
  );

  // Dropped, or a space removed at the end of the line: never a CRLF with
  // the <br>, nor a missing glyph.
  it.each(ALL)("drops a CR before a <br> under %s", (ws) => {
    expect(collapseWhiteSpace(["a\r", "b"], ws)).toBe("a\nb");
  });

  it.each(ALL)(
    "keeps a line separator a space next to a <br> under %s",
    (ws) => {
      expect(collapseWhiteSpace(["a\u2028", "b"], ws)).toBe("a\u00a0\u200b\nb");
    },
  );
});

describe("collapseWhiteSpace: separators and control characters", () => {
  const ALL = ["normal", "nowrap", "pre-line", "pre", "pre-wrap"] as const;

  it.each(ALL)(
    "sets a separator as a no-break space and a break under %s",
    (ws) => {
      expect(collapseWhiteSpace("a\u2028b", ws)).toBe("a\u00a0\u200bb");
      expect(collapseWhiteSpace("a\u2029b", ws)).toBe("a\u00a0\u200bb");
      // Neither collapsed with the spaces around it nor removed at the end.
      expect(collapseWhiteSpace("a \u2028", ws)).toBe("a \u00a0\u200b");
    },
  );

  it.each(ALL)("removes form feeds and vertical tabs under %s", (ws) => {
    expect(collapseWhiteSpace("a\fb\vc", ws)).toBe("abc");
  });

  it("collapses the spaces around a removed form feed", () => {
    expect(collapseWhiteSpace("a \f b", "normal")).toBe("a b");
    expect(collapseWhiteSpace("a \f b", "pre")).toBe("a  b");
  });
});

describe("isWhiteSpaceOnly", () => {
  it.each([
    ["", true],
    [" ", true],
    ["\n  \t\r\n", true],
    ["\u00a0", false],
    [" a ", false],
    ["\f", true],
    ["\v", true],
    ["\u2028", false],
  ])("%j: %s", (text, expected) => {
    expect(isWhiteSpaceOnly(text)).toBe(expected);
  });
});
