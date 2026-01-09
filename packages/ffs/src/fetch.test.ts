import { describe, test, expect } from "vitest";
import { ffsFetch } from "./fetch";

describe("ffsFetch data URL support", () => {
  test("fetches text from data URL", async () => {
    const response = await ffsFetch("data:text/plain;base64,SGVsbG8gV29ybGQ=");
    expect(response.ok).toBe(true);
    expect(await response.text()).toBe("Hello World");
  });

  test("fetches binary from data URL", async () => {
    // 1x1 red PNG
    const response = await ffsFetch(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    );
    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
