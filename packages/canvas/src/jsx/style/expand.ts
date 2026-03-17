// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { ExpandedStyle } from "./compute.ts";

type RawStyle = Record<string, unknown>;

const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

/**
 * Parse a CSS shorthand value like "10px 20px" into 1-4 parts.
 */
function parseSides(value: string): string[] {
  const parts = value.toString().split(/\s+/).filter(Boolean);
  switch (parts.length) {
    case 1:
      return [parts[0]!, parts[0]!, parts[0]!, parts[0]!];
    case 2:
      return [parts[0]!, parts[1]!, parts[0]!, parts[1]!];
    case 3:
      return [parts[0]!, parts[1]!, parts[2]!, parts[1]!];
    default:
      return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
  }
}

function parseValue(v: unknown): number | string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  if (s === "auto") return "auto";
  const n = Number(s);
  if (s !== "" && !isNaN(n)) return n;
  return s;
}

/**
 * Expand CSS shorthand properties into their longhand equivalents.
 * Mutates and returns the style object.
 */
export function expandStyle(
  raw: RawStyle,
  fontFamilies?: string[],
): ExpandedStyle {
  const style = { ...raw } as Record<string, unknown>;

  // margin shorthand
  if (style.margin !== undefined) {
    const sides = parseSides(String(style.margin));
    for (let i = 0; i < 4; i++) {
      const key = `margin${SIDES[i]}`;
      if (style[key] === undefined) style[key] = parseValue(sides[i]);
    }
    delete style.margin;
  }

  // padding shorthand
  if (style.padding !== undefined) {
    const sides = parseSides(String(style.padding));
    for (let i = 0; i < 4; i++) {
      const key = `padding${SIDES[i]}`;
      if (style[key] === undefined) style[key] = parseValue(sides[i]);
    }
    delete style.padding;
  }

  // borderRadius shorthand
  if (style.borderRadius !== undefined) {
    const sides = parseSides(String(style.borderRadius));
    const corners = [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ];
    for (let i = 0; i < 4; i++) {
      if (style[corners[i]!] === undefined)
        style[corners[i]!] = parseValue(sides[i]);
    }
    delete style.borderRadius;
  }

  // borderWidth shorthand
  if (style.borderWidth !== undefined) {
    const sides = parseSides(String(style.borderWidth));
    for (let i = 0; i < 4; i++) {
      const key = `border${SIDES[i]}Width`;
      if (style[key] === undefined) style[key] = parseValue(sides[i]);
    }
    delete style.borderWidth;
  }

  // borderColor shorthand
  if (style.borderColor !== undefined) {
    const val = style.borderColor;
    for (const side of SIDES) {
      const key = `border${side}Color`;
      if (style[key] === undefined) style[key] = val;
    }
    delete style.borderColor;
  }

  // borderStyle shorthand
  if (style.borderStyle !== undefined) {
    const val = style.borderStyle;
    for (const side of SIDES) {
      const key = `border${side}Style`;
      if (style[key] === undefined) style[key] = val;
    }
    delete style.borderStyle;
  }

  // border shorthand (e.g. "1px solid black")
  if (style.border !== undefined) {
    const parts = String(style.border).split(/\s+/);
    const width = parseValue(parts[0]);
    const borderStyle = parts[1] ?? "solid";
    const color = parts[2] ?? "black";
    for (const side of SIDES) {
      if (style[`border${side}Width`] === undefined)
        style[`border${side}Width`] = width;
      if (style[`border${side}Style`] === undefined)
        style[`border${side}Style`] = borderStyle;
      if (style[`border${side}Color`] === undefined)
        style[`border${side}Color`] = color;
    }
    delete style.border;
  }

  // Per-side border shorthands (e.g. borderLeft: "3px solid white")
  for (const side of SIDES) {
    const key = `border${side}`;
    if (style[key] !== undefined) {
      const parts = String(style[key]).split(/\s+/);
      const width = parseValue(parts[0]);
      const borderStyle = parts[1] ?? "solid";
      const color = parts[2] ?? "black";
      if (style[`${key}Width`] === undefined) style[`${key}Width`] = width;
      if (style[`${key}Style`] === undefined)
        style[`${key}Style`] = borderStyle;
      if (style[`${key}Color`] === undefined) style[`${key}Color`] = color;
      delete style[key];
    }
  }

  // flex shorthand
  if (style.flex !== undefined) {
    const val = String(style.flex);
    if (val === "none") {
      if (style.flexGrow === undefined) style.flexGrow = 0;
      if (style.flexShrink === undefined) style.flexShrink = 0;
      if (style.flexBasis === undefined) style.flexBasis = "auto";
    } else {
      const parts = val.split(/\s+/);
      if (parts.length === 1) {
        const n = parseFloat(parts[0]!);
        if (!isNaN(n)) {
          if (style.flexGrow === undefined) style.flexGrow = n;
          if (style.flexShrink === undefined) style.flexShrink = 1;
          if (style.flexBasis === undefined) style.flexBasis = 0;
        }
      } else if (parts.length === 2) {
        if (style.flexGrow === undefined)
          style.flexGrow = parseFloat(parts[0]!);
        if (style.flexShrink === undefined)
          style.flexShrink = parseFloat(parts[1]!);
      } else if (parts.length >= 3) {
        if (style.flexGrow === undefined)
          style.flexGrow = parseFloat(parts[0]!);
        if (style.flexShrink === undefined)
          style.flexShrink = parseFloat(parts[1]!);
        if (style.flexBasis === undefined)
          style.flexBasis = parseValue(parts[2]);
      }
    }
    delete style.flex;
  }

  // gap shorthand
  if (style.gap !== undefined) {
    const sides = parseSides(String(style.gap));
    if (style.rowGap === undefined) style.rowGap = parseValue(sides[0]);
    if (style.columnGap === undefined) style.columnGap = parseValue(sides[1]);
    delete style.gap;
  }

  // background shorthand
  if (style.background !== undefined) {
    const bg = String(style.background);
    if (bg.includes("gradient(") || bg.includes("url(")) {
      if (style.backgroundImage === undefined) style.backgroundImage = bg;
    } else {
      if (style.backgroundColor === undefined) style.backgroundColor = bg;
    }
    delete style.background;
  }

  // overflow shorthand
  if (style.overflow !== undefined) {
    if (style.overflowX === undefined) style.overflowX = style.overflow;
    if (style.overflowY === undefined) style.overflowY = style.overflow;
  }

  // textBox shorthand (e.g. "trim-both cap alphabetic")
  if (style.textBox !== undefined) {
    const val = String(style.textBox);
    if (val === "normal" || val === "none") {
      style.textBoxTrim ??= "none";
    } else {
      const parts = val.split(/\s+/);
      style.textBoxTrim ??= parts[0];
      if (parts.length > 1) {
        style.textBoxEdge ??= parts.slice(1).join(" ");
      }
    }
    delete style.textBox;
  }

  // fontFamily normalization
  if (typeof style.fontFamily === "string") {
    const families = style.fontFamily
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    if (fontFamilies) {
      const present = new Set(families);
      for (const name of fontFamilies) {
        if (!present.has(name)) families.push(name);
      }
    }
    style.fontFamily = families.join(", ");
  }

  return style as unknown as ExpandedStyle;
}
