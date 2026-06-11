import { describe, expect, it } from "vitest";
import { resolveBaseUrl } from "./base-url";

describe("resolveBaseUrl", () => {
  it("defaults to the dev server address when unset", () => {
    const result = resolveBaseUrl(undefined, "127.0.0.1", 3839);
    expect(result).toEqual({
      baseUrl: "http://127.0.0.1:3839",
      defaulted: true,
    });
  });

  it("keeps a matching local BASE_URL without warning", () => {
    const result = resolveBaseUrl("http://localhost:3839", "127.0.0.1", 3839);
    expect(result.baseUrl).toBe("http://localhost:3839");
    expect(result.defaulted).toBe(false);
    expect(result.warning).toBeUndefined();
  });

  it("warns when a local BASE_URL points at a different port", () => {
    const result = resolveBaseUrl("http://localhost:3839", "127.0.0.1", 3840);
    expect(result.baseUrl).toBe("http://localhost:3839");
    expect(result.warning).toMatch(/does not match the dev server port 3840/);
  });

  it("treats the bound host itself as local", () => {
    const result = resolveBaseUrl("http://0.0.0.0:3000", "0.0.0.0", 3839);
    expect(result.warning).toBeDefined();
  });

  it("leaves non-local BASE_URLs alone even on port mismatch", () => {
    const result = resolveBaseUrl(
      "https://demo.example.com",
      "127.0.0.1",
      4000,
    );
    expect(result.baseUrl).toBe("https://demo.example.com");
    expect(result.warning).toBeUndefined();
  });

  it("compares against implicit default ports", () => {
    const result = resolveBaseUrl("http://localhost", "127.0.0.1", 3839);
    expect(result.warning).toMatch(/does not match/);
  });

  it("passes through an unparseable BASE_URL", () => {
    const result = resolveBaseUrl("not a url", "127.0.0.1", 3839);
    expect(result.baseUrl).toBe("not a url");
    expect(result.warning).toBeUndefined();
  });
});
