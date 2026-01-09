import { describe, expect, it } from "vitest";
import { hashUrlToId } from "./utils";

describe("hashUrlToId", () => {
  it("is deterministic for the same URL", () => {
    const url = "https://example.com/assets/image.png?v=123#frag";
    expect(hashUrlToId(url)).toBe(hashUrlToId(url));
  });

  it("usually differs for different URLs", () => {
    const a = "https://example.com/a.png";
    const b = "https://example.com/b.png";
    expect(hashUrlToId(a)).not.toBe(hashUrlToId(b));
  });

  it("returns a compact base36-ish id", () => {
    const url =
      "https://example.com/some/really/long/path/to/an/asset/that/keeps/going/forever.png?with=query&params=that&are=long";
    const id = hashUrlToId(url);
    expect(id).toMatch(/^[0-9a-z]+$/);
    expect(id.length).toBeLessThan(url.length);
  });

  it("handles very long URLs", () => {
    const url = `https://example.com/${"a".repeat(10_000)}`;
    expect(() => hashUrlToId(url)).not.toThrow();
  });
});
