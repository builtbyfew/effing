import { describe, test, expect, afterEach, vi } from "vitest";
import {
  parseUrlRewrites,
  rewriteUrl,
  urlRewrites,
  UrlRewriteConfigError,
} from "./rewrite";

describe("parseUrlRewrites", () => {
  test("parses a JSON object of prefixes, longest first", () => {
    expect(
      parseUrlRewrites(
        JSON.stringify({
          "https://a.example/": "http://a-internal:8080/",
          "https://a.example/deep/": "http://deep-internal/",
        }),
      ),
    ).toEqual([
      { from: "https://a.example/deep/", to: "http://deep-internal/" },
      { from: "https://a.example/", to: "http://a-internal:8080/" },
    ]);
  });

  test("normalizes prefixes", () => {
    expect(
      parseUrlRewrites(
        JSON.stringify({ "HTTPS://A.Example:443/": "https://B.example/" }),
      ),
    ).toEqual([{ from: "https://a.example/", to: "https://b.example/" }]);
  });

  test("accepts an empty object", () => {
    expect(parseUrlRewrites("{}")).toEqual([]);
  });

  test.each([
    ["not JSON", "nope"],
    ["an array", "[]"],
    ["null", "null"],
    ["a non-string target", JSON.stringify({ "https://a.example/": 1 })],
    ["a relative URL", JSON.stringify({ "/a/": "https://b.example/" })],
    [
      "a non-http protocol",
      JSON.stringify({ "file:///a/": "https://b.example/" }),
    ],
    [
      "a prefix not ending in /",
      JSON.stringify({ "https://a.example/x": "https://b.example/" }),
    ],
    [
      "a target not ending in /",
      JSON.stringify({ "https://a.example/": "https://b.example/x" }),
    ],
    [
      "a query",
      JSON.stringify({ "https://a.example/?k=1": "https://b.example/" }),
    ],
    [
      "credentials",
      JSON.stringify({ "https://a.example/": "https://u:p@b.example/" }),
    ],
  ])("rejects %s", (_name, raw) => {
    expect(() => parseUrlRewrites(raw)).toThrow(UrlRewriteConfigError);
  });
});

describe("rewriteUrl", () => {
  const rewrites = parseUrlRewrites(
    JSON.stringify({
      "https://fn.example/": "https://fn-internal.example/",
      "https://fn.example/special/": "http://special-internal/",
    }),
  );

  test("rewrites a matching prefix, keeping path and query", () => {
    expect(
      rewriteUrl("https://fn.example/acct/proj/mod?x=1&y=2", rewrites),
    ).toBe("https://fn-internal.example/acct/proj/mod?x=1&y=2");
  });

  test("prefers the longest matching prefix", () => {
    expect(rewriteUrl("https://fn.example/special/a.tar", rewrites)).toBe(
      "http://special-internal/a.tar",
    );
  });

  test("matches case-insensitively on the host and with an explicit default port", () => {
    expect(rewriteUrl("https://FN.example:443/a", rewrites)).toBe(
      "https://fn-internal.example/a",
    );
  });

  test("doesn't match a host that merely starts with the prefix's host", () => {
    const url = "https://fn.example.evil.test/a";
    expect(rewriteUrl(url, rewrites)).toBe(url);
  });

  test("doesn't match another scheme or port", () => {
    for (const url of ["http://fn.example/a", "https://fn.example:8443/a"]) {
      expect(rewriteUrl(url, rewrites)).toBe(url);
    }
  });

  test("leaves non-matching and non-absolute URLs untouched", () => {
    for (const url of [
      "https://other.example/a",
      "data:text/plain,hi",
      "not a url",
    ]) {
      expect(rewriteUrl(url, rewrites)).toBe(url);
    }
  });

  test("is a no-op without rewrites", () => {
    expect(rewriteUrl("https://FN.example:443/a", [])).toBe(
      "https://FN.example:443/a",
    );
  });
});

describe("urlRewrites", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is empty when FFS_URL_REWRITES is unset or blank", () => {
    vi.stubEnv("FFS_URL_REWRITES", "");
    expect(urlRewrites()).toEqual([]);
    vi.stubEnv("FFS_URL_REWRITES", "  ");
    expect(urlRewrites()).toEqual([]);
  });

  test("reads FFS_URL_REWRITES and follows changes", () => {
    vi.stubEnv(
      "FFS_URL_REWRITES",
      JSON.stringify({ "https://a.example/": "https://b.example/" }),
    );
    expect(urlRewrites()).toEqual([
      { from: "https://a.example/", to: "https://b.example/" },
    ]);
    vi.stubEnv(
      "FFS_URL_REWRITES",
      JSON.stringify({ "https://c.example/": "https://d.example/" }),
    );
    expect(urlRewrites()).toEqual([
      { from: "https://c.example/", to: "https://d.example/" },
    ]);
  });

  test("keeps throwing while FFS_URL_REWRITES is malformed", () => {
    vi.stubEnv("FFS_URL_REWRITES", "nope");
    expect(() => urlRewrites()).toThrow(UrlRewriteConfigError);
    expect(() => urlRewrites()).toThrow(UrlRewriteConfigError);
  });
});
