import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./jsx/font.ts", () => ({
  registerFont: vi.fn(),
  getFontMetrics: vi.fn(() => null),
}));

vi.mock("./jsx/text/index.ts", () => ({
  layoutText: vi.fn(),
}));

import { registerFont } from "./jsx/font.ts";
import { layoutText } from "./jsx/text/index.ts";
import { findLargestUsableFontSize } from "./fit-text.ts";
import type { FontData } from "./types.ts";

const font: FontData = {
  name: "TestFont",
  data: Buffer.from("fake"),
  weight: 400,
  style: "normal",
};

describe("findLargestUsableFontSize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binary searches to the correct font size", () => {
    // Text fits at fontSize <= 42: width = fontSize * 5, height = fontSize * 1.2
    // At maxWidth=210, maxHeight=60: 42*5=210 fits, 43*5=215 doesn't
    vi.mocked(layoutText).mockImplementation((_text, style) => {
      const fs = style.fontSize ?? 16;
      return { segments: [], width: fs * 5, height: fs * 1.2 };
    });

    const result = findLargestUsableFontSize({
      text: "Hello",
      font,
      maxWidth: 210,
      maxHeight: 60,
    });

    expect(result).toBe(42);
  });

  it("returns minFontSize when nothing fits", () => {
    vi.mocked(layoutText).mockReturnValue({
      segments: [],
      width: 9999,
      height: 9999,
    });

    const result = findLargestUsableFontSize({
      text: "Huge text",
      font,
      maxWidth: 100,
      maxHeight: 50,
    });

    expect(result).toBe(1);
  });

  it("respects maxFontSize ceiling", () => {
    // Everything fits — should cap at maxFontSize
    vi.mocked(layoutText).mockReturnValue({
      segments: [],
      width: 1,
      height: 1,
    });

    const result = findLargestUsableFontSize({
      text: "Tiny",
      font,
      maxWidth: 10000,
      maxHeight: 10000,
      maxFontSize: 72,
    });

    expect(result).toBe(72);
  });

  it("respects custom minFontSize", () => {
    vi.mocked(layoutText).mockReturnValue({
      segments: [],
      width: 9999,
      height: 9999,
    });

    const result = findLargestUsableFontSize({
      text: "Won't fit",
      font,
      maxWidth: 100,
      maxHeight: 50,
      minFontSize: 10,
    });

    expect(result).toBe(10);
  });

  it("maps lineHeight 'normal' to undefined in style", () => {
    vi.mocked(layoutText).mockReturnValue({
      segments: [],
      width: 10,
      height: 10,
    });

    findLargestUsableFontSize({
      text: "Test",
      font,
      maxWidth: 100,
      maxHeight: 100,
      lineHeight: "normal",
    });

    const calls = vi.mocked(layoutText).mock.calls;
    // Check that at least one call was made, and lineHeight is undefined
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]![1].lineHeight).toBeUndefined();
  });

  it("passes numeric lineHeight through to style", () => {
    vi.mocked(layoutText).mockReturnValue({
      segments: [],
      width: 10,
      height: 10,
    });

    findLargestUsableFontSize({
      text: "Test",
      font,
      maxWidth: 100,
      maxHeight: 100,
      lineHeight: 1.5,
    });

    const calls = vi.mocked(layoutText).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]![1].lineHeight).toBe(1.5);
  });

  it("calls registerFont with the provided FontData", () => {
    vi.mocked(layoutText).mockReturnValue({
      segments: [],
      width: 10,
      height: 10,
    });

    findLargestUsableFontSize({
      text: "Test",
      font,
      maxWidth: 100,
      maxHeight: 100,
    });

    expect(registerFont).toHaveBeenCalledWith(font);
  });
});
