import { describe, expect, it } from "vitest";
import { parseBoxShadow, parseTextShadow, splitTopLevel } from "./shadow.ts";

const shadow = (
  offsetX: number,
  offsetY: number,
  blur: number,
  spread: number,
  color: string,
  inset = false,
) => ({ offsetX, offsetY, blur, spread, color, inset });

describe("parseBoxShadow", () => {
  it.each([
    ["2px 3px red", [shadow(2, 3, 0, 0, "red")]],
    ["2px 3px 4px red", [shadow(2, 3, 4, 0, "red")]],
    ["2px 3px 4px 5px red", [shadow(2, 3, 4, 5, "red")]],
    ["0 12px 8px -6px #1e293b", [shadow(0, 12, 8, -6, "#1e293b")]],
    ["red 2px 3px 4px", [shadow(2, 3, 4, 0, "red")]],
    ["inset 2px 3px 4px red", [shadow(2, 3, 4, 0, "red", true)]],
    ["2px 3px 4px red inset", [shadow(2, 3, 4, 0, "red", true)]],
    ["inset red 2px 3px", [shadow(2, 3, 0, 0, "red", true)]],
    ["red inset 2px 3px", [shadow(2, 3, 0, 0, "red", true)]],
    ["2px 3px inset red", [shadow(2, 3, 0, 0, "red", true)]],
    ["INSET 2PX 3px Red", [shadow(2, 3, 0, 0, "Red", true)]],
    ["-.5px +1.5px 1e1px", [shadow(-0.5, 1.5, 10, 0, "black")]],
    ["2 3 4 red", [shadow(2, 3, 4, 0, "red")]],
    ["2px 2px rgba(0, 0, 0, 0.5)", [shadow(2, 2, 0, 0, "rgba(0, 0, 0, 0.5)")]],
    ["rgb(0 0 0 / 50%) 1px 1px", [shadow(1, 1, 0, 0, "rgb(0 0 0 / 50%)")]],
    [
      "  0 8px 16px 6px #0002 ,\n0 2px 6px 0 hsl(0, 0%, 0%) ",
      [shadow(0, 8, 16, 6, "#0002"), shadow(0, 2, 6, 0, "hsl(0, 0%, 0%)")],
    ],
    [
      "inset 0 0 0 4px red, 0 0 0 4px blue",
      [shadow(0, 0, 0, 4, "red", true), shadow(0, 0, 0, 4, "blue")],
    ],
  ])("parses %j", (value, expected) => {
    expect(parseBoxShadow(value, "black")).toEqual(expected);
  });

  it("casts a shadow without a colour in currentColor", () => {
    expect(parseBoxShadow("2px 3px", "#22c55e")).toEqual([
      shadow(2, 3, 0, 0, "#22c55e"),
    ]);
    expect(parseBoxShadow("2px 3px currentColor", "#22c55e")).toEqual([
      shadow(2, 3, 0, 0, "#22c55e"),
    ]);
  });

  it.each([
    "",
    "none",
    "NONE",
    "red",
    "2px",
    "inset 2px",
    "2px 3px 4px 5px 6px red",
    "2px 3px -4px red",
    "2px red 3px",
    "2px 3px red 4px",
    "2px 3px red blue",
    "inset inset 2px 3px",
    "2px 3px 10% red",
    "2px 3px 1ch red",
    "2px 3px red,",
    ", 2px 3px red",
    "2px 3px red,, 1px 1px blue",
    // One invalid shadow invalidates the whole list.
    "2px 3px red, 2px blue",
  ])("ignores %j", (value) => {
    expect(parseBoxShadow(value, "black")).toEqual([]);
  });
});

describe("parseTextShadow", () => {
  it.each([
    ["3px 3px red", [shadow(3, 3, 0, 0, "red")]],
    ["3px 3px 4px red", [shadow(3, 3, 4, 0, "red")]],
    ["red 3px 3px 4px", [shadow(3, 3, 4, 0, "red")]],
    ["#ef4444 2px 3px", [shadow(2, 3, 0, 0, "#ef4444")]],
    ["3px 3px", [shadow(3, 3, 0, 0, "currentColor-value")]],
    [
      "2px 2px 0 red, 4px 4px 0 rgb(0, 0, 255), 0 0 6px",
      [
        shadow(2, 2, 0, 0, "red"),
        shadow(4, 4, 0, 0, "rgb(0, 0, 255)"),
        shadow(0, 0, 6, 0, "currentColor-value"),
      ],
    ],
  ])("parses %j", (value, expected) => {
    expect(parseTextShadow(value, "currentColor-value")).toEqual(expected);
  });

  it.each([
    "none",
    "3px",
    "3px 3px 4px 5px red",
    "inset 3px 3px red",
    "3px 3px -1px red",
    "3px red 3px",
    "3px 3px red, 1px",
  ])("ignores %j", (value) => {
    expect(parseTextShadow(value, "black")).toEqual([]);
  });
});

describe("splitTopLevel", () => {
  it("splits outside parentheses only", () => {
    expect(splitTopLevel("a, rgb(1, 2, 3), b", ",")).toEqual([
      "a",
      "rgb(1, 2, 3)",
      "b",
    ]);
    expect(splitTopLevel("  a\trgb(1 2 3)\n b ", " ")).toEqual([
      "a",
      "rgb(1 2 3)",
      "b",
    ]);
  });
});
