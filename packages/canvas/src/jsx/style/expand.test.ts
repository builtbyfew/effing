import { describe, expect, it } from "vitest";
import { expandStyle } from "./expand.ts";

describe("expandStyle – per-side border shorthands", () => {
  it("expands borderLeft into width, style, and color", () => {
    const result = expandStyle({ borderLeft: "3px solid white" });
    expect(result.borderLeftWidth).toBe("3px");
    expect(result.borderLeftStyle).toBe("solid");
    expect(result.borderLeftColor).toBe("white");
    expect(result).not.toHaveProperty("borderLeft");
  });

  it("expands borderRight", () => {
    const result = expandStyle({ borderRight: "2px dashed red" });
    expect(result.borderRightWidth).toBe("2px");
    expect(result.borderRightStyle).toBe("dashed");
    expect(result.borderRightColor).toBe("red");
  });

  it("expands borderTop", () => {
    const result = expandStyle({ borderTop: "1px solid #ccc" });
    expect(result.borderTopWidth).toBe("1px");
    expect(result.borderTopStyle).toBe("solid");
    expect(result.borderTopColor).toBe("#ccc");
  });

  it("expands borderBottom", () => {
    const result = expandStyle({ borderBottom: "4px dotted blue" });
    expect(result.borderBottomWidth).toBe("4px");
    expect(result.borderBottomStyle).toBe("dotted");
    expect(result.borderBottomColor).toBe("blue");
  });

  it("defaults style to solid and color to black", () => {
    const result = expandStyle({ borderLeft: "5px" });
    expect(result.borderLeftWidth).toBe("5px");
    expect(result.borderLeftStyle).toBe("solid");
    expect(result.borderLeftColor).toBe("black");
  });

  it("does not override explicit longhands", () => {
    const result = expandStyle({
      borderLeft: "3px solid white",
      borderLeftColor: "red",
    });
    expect(result.borderLeftWidth).toBe("3px");
    expect(result.borderLeftColor).toBe("red");
  });
});

describe("expandStyle – textBox shorthand", () => {
  it("expands 'trim-both cap alphabetic' into trim and edge", () => {
    const result = expandStyle({ textBox: "trim-both cap alphabetic" });
    expect(result.textBoxTrim).toBe("trim-both");
    expect(result.textBoxEdge).toBe("cap alphabetic");
    expect(result).not.toHaveProperty("textBox");
  });

  it("expands 'trim-start text' into trim and edge", () => {
    const result = expandStyle({ textBox: "trim-start text" });
    expect(result.textBoxTrim).toBe("trim-start");
    expect(result.textBoxEdge).toBe("text");
  });

  it("expands 'none' to textBoxTrim none", () => {
    const result = expandStyle({ textBox: "none" });
    expect(result.textBoxTrim).toBe("none");
    expect(result.textBoxEdge).toBeUndefined();
  });

  it("expands 'normal' to textBoxTrim none", () => {
    const result = expandStyle({ textBox: "normal" });
    expect(result.textBoxTrim).toBe("none");
    expect(result.textBoxEdge).toBeUndefined();
  });

  it("does not override explicit longhands", () => {
    const result = expandStyle({
      textBox: "trim-both cap alphabetic",
      textBoxTrim: "trim-end",
    });
    expect(result.textBoxTrim).toBe("trim-end");
    expect(result.textBoxEdge).toBe("cap alphabetic");
  });

  it("handles trim-end with ex alphabetic", () => {
    const result = expandStyle({ textBox: "trim-end ex alphabetic" });
    expect(result.textBoxTrim).toBe("trim-end");
    expect(result.textBoxEdge).toBe("ex alphabetic");
  });
});
