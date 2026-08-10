import { describe, expect, test } from "vitest";
import { parseProps } from "./props";

describe("parseProps", () => {
  test("defaults to an empty object", () => {
    expect(parseProps(undefined)).toEqual({});
    expect(parseProps("")).toEqual({});
  });

  test("parses a JSON object", () => {
    expect(parseProps('{"text":"hi","n":2}')).toEqual({ text: "hi", n: 2 });
  });

  test("rejects invalid JSON", () => {
    expect(() => parseProps("{nope")).toThrow(/--props is not valid JSON/);
  });

  test("rejects non-object JSON", () => {
    expect(() => parseProps("[1,2]")).toThrow(/must be a JSON object/);
    expect(() => parseProps("null")).toThrow(/must be a JSON object/);
    expect(() => parseProps('"str"')).toThrow(/must be a JSON object/);
  });
});
