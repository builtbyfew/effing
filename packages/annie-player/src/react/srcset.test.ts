import { describe, expect, it } from "vitest";
import {
  parseSrcset,
  replaceSrcsetCandidate,
  sameUrl,
  serializeSrcset,
} from "./srcset";

const base = "https://example.com/page/index.html";

describe("parseSrcset", () => {
  it("splits candidates with x and w descriptors", () => {
    expect(parseSrcset("a.png 1x, b.qoi 2x")).toEqual([
      { url: "a.png", descriptors: "1x" },
      { url: "b.qoi", descriptors: "2x" },
    ]);
    expect(parseSrcset("small.png 320w,large.qoi 1280w")).toEqual([
      { url: "small.png", descriptors: "320w" },
      { url: "large.qoi", descriptors: "1280w" },
    ]);
  });

  it("accepts a candidate without descriptors, and extra whitespace and commas", () => {
    expect(parseSrcset("  a.png ,\n\t b.qoi 2x ,, ")).toEqual([
      { url: "a.png", descriptors: "" },
      { url: "b.qoi", descriptors: "2x" },
    ]);
  });

  it("ends a candidate at commas trailing its URL", () => {
    expect(parseSrcset("a.png,b.qoi 2x")).toEqual([
      { url: "a.png,b.qoi", descriptors: "2x" },
    ]);
    expect(parseSrcset("a.png, b.qoi 2x")).toEqual([
      { url: "a.png", descriptors: "" },
      { url: "b.qoi", descriptors: "2x" },
    ]);
  });

  it("keeps commas inside a data URL", () => {
    expect(
      parseSrcset("data:image/png;base64,iVBORw0KGgo= 1x, b.qoi 2x"),
    ).toEqual([
      { url: "data:image/png;base64,iVBORw0KGgo=", descriptors: "1x" },
      { url: "b.qoi", descriptors: "2x" },
    ]);
  });

  it("keeps commas inside parenthesised descriptors", () => {
    expect(parseSrcset("a.png 1x (future, thing), b.qoi 2x")).toEqual([
      { url: "a.png", descriptors: "1x (future, thing)" },
      { url: "b.qoi", descriptors: "2x" },
    ]);
  });

  it("closes parentheses at the first ), without nesting, as browsers do", () => {
    expect(parseSrcset("a.png 1x ((x), y) 2x, b.qoi 3x")).toEqual([
      { url: "a.png", descriptors: "1x ((x)" },
      { url: "y)", descriptors: "2x" },
      { url: "b.qoi", descriptors: "3x" },
    ]);
  });

  it("parses an empty srcset to no candidates", () => {
    expect(parseSrcset("")).toEqual([]);
  });
});

describe("serializeSrcset", () => {
  it("joins candidates", () => {
    expect(
      serializeSrcset([
        { url: "a.png", descriptors: "" },
        { url: "b.qoi", descriptors: "2x" },
      ]),
    ).toBe("a.png, b.qoi 2x");
  });
});

describe("sameUrl", () => {
  it("compares URLs resolved against the base", () => {
    expect(
      sameUrl("img/a.qoi", "https://example.com/page/img/a.qoi", base),
    ).toBe(true);
    expect(sameUrl("./img/a.qoi", "img/a.qoi", base)).toBe(true);
    expect(sameUrl("/img/a.qoi", "img/a.qoi", base)).toBe(false);
  });

  it("ignores fragments", () => {
    expect(
      sameUrl("./x.qoi", "https://example.com/page/x.qoi#frag", base),
    ).toBe(true);
    expect(sameUrl("x.qoi#a", "x.qoi#b", base)).toBe(true);
    expect(sameUrl("x.qoi?a", "x.qoi?b", base)).toBe(false);
  });

  it("treats URLs that don't parse as different", () => {
    expect(sameUrl("http://[bad", "http://[bad", base)).toBe(false);
  });
});

describe("replaceSrcsetCandidate", () => {
  it("replaces an x candidate, keeping its descriptor", () => {
    expect(
      replaceSrcsetCandidate(
        "a.png 1x, b.qoi 2x",
        "https://example.com/page/b.qoi",
        "blob:png",
        base,
      ),
    ).toBe("a.png 1x, blob:png 2x");
  });

  it("replaces a w candidate, keeping its descriptor", () => {
    expect(
      replaceSrcsetCandidate(
        "/s.png 320w, /l.qoi 1280w",
        "https://example.com/l.qoi",
        "blob:png",
        base,
      ),
    ).toBe("/s.png 320w, blob:png 1280w");
  });

  it("matches relative candidates against an absolute URL", () => {
    expect(
      replaceSrcsetCandidate(
        "../x/a.qoi 2x",
        "https://example.com/x/a.qoi",
        "blob:png",
        base,
      ),
    ).toBe("blob:png 2x");
  });

  it("replaces every candidate for the same image", () => {
    expect(
      replaceSrcsetCandidate(
        "k.qoi 1x, other.png 1.5x, ./k.qoi 2x",
        "https://example.com/page/k.qoi",
        "blob:png",
        base,
      ),
    ).toBe("blob:png 1x, other.png 1.5x, blob:png 2x");
  });

  it("matches a URL with a stale fragment", () => {
    expect(
      replaceSrcsetCandidate(
        "a.png 1x, ./x.qoi 2x",
        "https://example.com/page/x.qoi#frag",
        "blob:png",
        base,
      ),
    ).toBe("a.png 1x, blob:png 2x");
  });

  it("returns null when no candidate matches", () => {
    expect(
      replaceSrcsetCandidate(
        "a.png 1x, b.qoi 2x",
        "https://example.com/c.qoi",
        "blob:png",
        base,
      ),
    ).toBeNull();
  });
});
