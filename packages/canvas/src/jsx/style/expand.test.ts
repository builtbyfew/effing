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

describe("expandStyle – margin, padding, border, flex, gap shorthands", () => {
  it("expands margin shorthand", () => {
    const style = expandStyle({ margin: "10" });
    expect(style.marginTop).toBe(10);
    expect(style.marginRight).toBe(10);
    expect(style.marginBottom).toBe(10);
    expect(style.marginLeft).toBe(10);
  });

  it("expands margin with 2 values", () => {
    const style = expandStyle({ margin: "10 20" });
    expect(style.marginTop).toBe(10);
    expect(style.marginRight).toBe(20);
    expect(style.marginBottom).toBe(10);
    expect(style.marginLeft).toBe(20);
  });

  it("expands padding shorthand", () => {
    const style = expandStyle({ padding: "5 10 15 20" });
    expect(style.paddingTop).toBe(5);
    expect(style.paddingRight).toBe(10);
    expect(style.paddingBottom).toBe(15);
    expect(style.paddingLeft).toBe(20);
  });

  it("expands borderRadius shorthand", () => {
    const style = expandStyle({ borderRadius: "8" });
    expect(style.borderTopLeftRadius).toBe(8);
    expect(style.borderTopRightRadius).toBe(8);
    expect(style.borderBottomRightRadius).toBe(8);
    expect(style.borderBottomLeftRadius).toBe(8);
  });

  it("expands border shorthand", () => {
    const style = expandStyle({ border: "2 solid red" });
    expect(style.borderTopWidth).toBe(2);
    expect(style.borderTopStyle).toBe("solid");
    expect(style.borderTopColor).toBe("red");
  });

  it("expands flex shorthand", () => {
    const style = expandStyle({ flex: "1" });
    expect(style.flexGrow).toBe(1);
    expect(style.flexShrink).toBe(1);
    expect(style.flexBasis).toBe(0);
  });

  it("expands gap shorthand", () => {
    const style = expandStyle({ gap: "10 20" });
    expect(style.rowGap).toBe(10);
    expect(style.columnGap).toBe(20);
  });

  it("preserves percentage borderRadius strings", () => {
    const style = expandStyle({ borderRadius: "50%" });
    expect(style.borderTopLeftRadius).toBe("50%");
    expect(style.borderTopRightRadius).toBe("50%");
    expect(style.borderBottomRightRadius).toBe("50%");
    expect(style.borderBottomLeftRadius).toBe("50%");
  });

  it("preserves unit strings in margin shorthand", () => {
    const style = expandStyle({ margin: "2em" });
    expect(style.marginTop).toBe("2em");
    expect(style.marginRight).toBe("2em");
    expect(style.marginBottom).toBe("2em");
    expect(style.marginLeft).toBe("2em");
  });

  it("preserves unit strings in borderRadius shorthand", () => {
    const style = expandStyle({ borderRadius: "10px" });
    expect(style.borderTopLeftRadius).toBe("10px");
    expect(style.borderTopRightRadius).toBe("10px");
    expect(style.borderBottomRightRadius).toBe("10px");
    expect(style.borderBottomLeftRadius).toBe("10px");
  });

  it("normalizes fontFamily", () => {
    const style = expandStyle({ fontFamily: "'Inter', sans-serif" });
    expect(style.fontFamily).toBe("Inter, sans-serif");
  });

  it("does not overwrite explicit longhand values", () => {
    const style = expandStyle({ margin: "10", marginTop: 20 });
    expect(style.marginTop).toBe(20);
    expect(style.marginRight).toBe(10);
  });
});
