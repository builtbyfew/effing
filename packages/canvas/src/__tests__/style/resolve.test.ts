import { describe, expect, it } from "vitest";
import {
  resolveStyle,
  resolveUnits,
  DEFAULT_STYLE,
} from "../../jsx/style/compute.ts";
import type { ExpandedStyle } from "../../jsx/style/compute.ts";

describe("resolveStyle", () => {
  it("inherits color from parent", () => {
    const style = resolveStyle({}, { ...DEFAULT_STYLE, color: "red" });
    expect(style.color).toBe("red");
  });

  it("inherits fontSize from parent", () => {
    const style = resolveStyle({}, { ...DEFAULT_STYLE, fontSize: 24 });
    expect(style.fontSize).toBe(24);
  });

  it("overrides inherited properties", () => {
    const style = resolveStyle(
      { color: "blue" },
      { ...DEFAULT_STYLE, color: "red" },
    );
    expect(style.color).toBe("blue");
  });

  it("resolves fontSize with em units relative to parent fontSize", () => {
    const input: ExpandedStyle = { fontSize: "4em" };
    const style = resolveStyle(input, { ...DEFAULT_STYLE, fontSize: 16 });
    expect(style.fontSize).toBe(64);
  });

  it("resolves fontSize with rem units relative to root fontSize", () => {
    const input: ExpandedStyle = { fontSize: "2rem" };
    const style = resolveStyle(input, DEFAULT_STYLE);
    expect(style.fontSize).toBe(2 * DEFAULT_STYLE.fontSize!);
  });

  it("resolves fontSize with px units", () => {
    const input: ExpandedStyle = { fontSize: "24px" };
    const style = resolveStyle(input, DEFAULT_STYLE);
    expect(style.fontSize).toBe(24);
  });

  it("preserves lineHeight multiplier for per-element resolution", () => {
    const style = resolveStyle(
      { lineHeight: 1.5 as number | string, fontSize: 20 },
      DEFAULT_STYLE,
    );
    // Multipliers (<=5) are kept as-is and resolved in text layout
    // using each element's own fontSize
    expect(style.lineHeight).toBe(1.5);
  });
});

describe("resolveUnits", () => {
  it("resolves vw to pixels using viewport width", () => {
    const style = resolveUnits({ width: "50vw" }, 800, 600);
    expect(style.width).toBe(400);
  });

  it("resolves vh to pixels using viewport height", () => {
    const style = resolveUnits({ height: "100vh" }, 800, 600);
    expect(style.height).toBe(600);
  });

  it("resolves vmin to the smaller viewport dimension", () => {
    const style = resolveUnits({ width: "50vmin" }, 800, 600);
    expect(style.width).toBe(300);
  });

  it("resolves vmax to the larger viewport dimension", () => {
    const style = resolveUnits({ width: "50vmax" }, 800, 600);
    expect(style.width).toBe(400);
  });

  it("resolves em relative to the element fontSize", () => {
    const style = resolveUnits({ width: "2em", fontSize: 20 }, 800, 600);
    expect(style.width).toBe(40);
  });

  it("resolves rem relative to root fontSize", () => {
    const style = resolveUnits({ width: "2rem" }, 800, 600, 16);
    expect(style.width).toBe(32);
  });

  it("resolves px explicitly", () => {
    const style = resolveUnits({ width: "120px" }, 800, 600);
    expect(style.width).toBe(120);
  });

  it("resolves pt (1pt = 96/72 px)", () => {
    const style = resolveUnits({ width: "72pt" }, 800, 600);
    expect(style.width).toBe(96);
  });

  it("resolves in (1in = 96px)", () => {
    const style = resolveUnits({ width: "1in" }, 800, 600);
    expect(style.width).toBe(96);
  });

  it("resolves cm", () => {
    const style = resolveUnits({ width: "2.54cm" }, 800, 600);
    expect(style.width).toBeCloseTo(96, 5);
  });

  it("resolves mm", () => {
    const style = resolveUnits({ width: "25.4mm" }, 800, 600);
    expect(style.width).toBeCloseTo(96, 5);
  });

  it("passes through plain numbers unchanged", () => {
    const style = resolveUnits({ width: 200 }, 800, 600);
    expect(style.width).toBe(200);
  });

  it("passes through percentage strings unchanged", () => {
    const style = resolveUnits({ width: "50%" }, 800, 600);
    expect(style.width).toBe("50%");
  });

  it("passes through auto unchanged", () => {
    const style = resolveUnits({ width: "auto" }, 800, 600);
    expect(style.width).toBe("auto");
  });

  it("resolves multiple properties at once", () => {
    const style = resolveUnits(
      {
        width: "100vw",
        height: "100vh",
        marginTop: "10vh",
        paddingLeft: "5vw",
      },
      400,
      300,
    );
    expect(style.width).toBe(400);
    expect(style.height).toBe(300);
    expect(style.marginTop).toBe(30);
    expect(style.paddingLeft).toBe(20);
  });
});
