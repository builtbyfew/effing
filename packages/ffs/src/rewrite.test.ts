import { describe, test, expect, afterEach, vi } from "vitest";
import {
  parseUrlRewrites,
  rewriteUrl,
  urlRewrites,
  UrlRewriteConfigError,
} from "./rewrite";

describe("parseUrlRewrites", () => {
  test("parses a JSON object of origins", () => {
    expect(
      parseUrlRewrites(
        JSON.stringify({
          "https://a.example/": "http://a-internal:8080/",
          "https://b.example/": "https://b-internal.example/",
        }),
      ),
    ).toEqual([
      { from: "https://a.example/", to: "http://a-internal:8080/" },
      { from: "https://b.example/", to: "https://b-internal.example/" },
    ]);
  });

  test("normalizes origins, with or without a trailing slash", () => {
    expect(
      parseUrlRewrites(
        JSON.stringify({ "HTTPS://A.Example:443": "https://B.example/" }),
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
      "a path on from",
      JSON.stringify({ "https://a.example/x/": "https://b.example/" }),
    ],
    [
      "a path on to",
      JSON.stringify({ "https://a.example/": "https://b.example/x/" }),
    ],
    [
      "a query",
      JSON.stringify({ "https://a.example/?k=1": "https://b.example/" }),
    ],
    [
      "an empty query on from",
      JSON.stringify({ "https://a.example/?": "https://b.example/" }),
    ],
    [
      "an empty query on to",
      JSON.stringify({ "https://a.example/": "https://b.example/?" }),
    ],
    [
      "an empty fragment",
      JSON.stringify({ "https://a.example/": "https://b.example/#" }),
    ],
    [
      "credentials",
      JSON.stringify({ "https://a.example/": "https://u:p@b.example/" }),
    ],
    [
      "two keys for the same origin",
      JSON.stringify({
        "https://A.example/": "https://one.example/",
        "https://a.example:443/": "https://two.example/",
      }),
    ],
  ])("rejects %s", (_name, raw) => {
    expect(() => parseUrlRewrites(raw)).toThrow(UrlRewriteConfigError);
  });
});

describe("rewriteUrl", () => {
  const rewrites = parseUrlRewrites(
    JSON.stringify({ "https://fn.example/": "https://fn-internal.example/" }),
  );

  test("rewrites a matching origin, keeping path, query and fragment", () => {
    expect(
      rewriteUrl("https://fn.example/acct/proj/mod?x=1&y=2#f", rewrites),
    ).toBe("https://fn-internal.example/acct/proj/mod?x=1&y=2#f");
  });

  test("rewrites a bare origin", () => {
    expect(rewriteUrl("https://fn.example", rewrites)).toBe(
      "https://fn-internal.example/",
    );
    expect(rewriteUrl("https://fn.example?x=1", rewrites)).toBe(
      "https://fn-internal.example/?x=1",
    );
  });

  test("passes dot segments through as the public origin would get them", () => {
    expect(rewriteUrl("https://fn.example/a/.x/../../b", rewrites)).toBe(
      `https://fn-internal.example${new URL("https://fn.example/a/.x/../../b").pathname}`,
    );
  });

  test("matches case-insensitively on the host and with an explicit default port", () => {
    expect(rewriteUrl("https://FN.example:443/a", rewrites)).toBe(
      "https://fn-internal.example/a",
    );
  });

  test.each([
    [
      "a host that starts with the rule's host",
      "https://fn.example.evil.test/a",
    ],
    ["a trailing-dot host", "https://fn.example./a"],
    ["credentials", "https://user:pw@fn.example/a"],
    ["another scheme", "http://fn.example/a"],
    ["another port", "https://fn.example:8443/a"],
    [
      "the rule only in the query",
      "https://other.example/?u=https://fn.example/",
    ],
    ["another origin", "https://other.example/a"],
    ["a data URL", "data:text/plain,hi"],
    ["a non-URL", "not a url"],
  ])("leaves a URL with %s untouched", (_name, url) => {
    expect(rewriteUrl(url, rewrites)).toBe(url);
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

  test("returns a frozen list", () => {
    vi.stubEnv(
      "FFS_URL_REWRITES",
      JSON.stringify({ "https://e.example/": "https://f.example/" }),
    );
    expect(Object.isFrozen(urlRewrites())).toBe(true);
  });

  test("keeps throwing while FFS_URL_REWRITES is malformed", () => {
    vi.stubEnv("FFS_URL_REWRITES", "nope");
    expect(() => urlRewrites()).toThrow(UrlRewriteConfigError);
    expect(() => urlRewrites()).toThrow(UrlRewriteConfigError);
  });
});
