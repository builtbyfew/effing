import { describe, test, expect } from "vitest";
import { hashUrl } from "./cache";

describe("hashUrl", () => {
  test("returns consistent hash for same URL", () => {
    const url = "https://example.com/image.png";
    const key1 = hashUrl(url);
    const key2 = hashUrl(url);

    expect(key1).toBe(key2);
  });

  test("returns different hashes for different URLs", () => {
    const key1 = hashUrl("https://example.com/image1.png");
    const key2 = hashUrl("https://example.com/image2.png");

    expect(key1).not.toBe(key2);
  });

  test("returns 16-character hex string", () => {
    const key = hashUrl("https://example.com/test.png");

    expect(key).toHaveLength(16);
    expect(key).toMatch(/^[a-f0-9]{16}$/);
  });

  test("handles URLs with query parameters", () => {
    const key1 = hashUrl("https://example.com/image.png?v=1");
    const key2 = hashUrl("https://example.com/image.png?v=2");

    expect(key1).not.toBe(key2);
  });

  test("handles long URLs", () => {
    const longUrl =
      "https://example.com/" +
      "a".repeat(1000) +
      "/image.png?token=" +
      "b".repeat(500);
    const key = hashUrl(longUrl);

    expect(key).toHaveLength(16);
    expect(key).toMatch(/^[a-f0-9]{16}$/);
  });

  test("handles special characters in URL", () => {
    const url = "https://example.com/path with spaces/file%20name.png";
    const key = hashUrl(url);

    expect(key).toHaveLength(16);
    expect(key).toMatch(/^[a-f0-9]{16}$/);
  });
});
