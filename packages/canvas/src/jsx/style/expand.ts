// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import { splitGradientArgs } from "../draw/gradient.ts";
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
    const parts = parseBackgroundShorthand(String(style.background));
    if (parts.image !== undefined && style.backgroundImage === undefined)
      style.backgroundImage = parts.image;
    if (parts.repeat !== undefined && style.backgroundRepeat === undefined)
      style.backgroundRepeat = parts.repeat;
    if (parts.size !== undefined && style.backgroundSize === undefined)
      style.backgroundSize = parts.size;
    if (parts.color !== undefined && style.backgroundColor === undefined)
      style.backgroundColor = parts.color;
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

  // WebkitTextStroke shorthand (e.g. "2px red")
  if (style.WebkitTextStroke !== undefined) {
    const val = String(style.WebkitTextStroke).trim();
    const match = val.match(/^(\S+)\s+(.+)$/);
    if (match) {
      if (style.WebkitTextStrokeWidth === undefined)
        style.WebkitTextStrokeWidth = parseValue(match[1]);
      if (style.WebkitTextStrokeColor === undefined)
        style.WebkitTextStrokeColor = match[2];
    } else {
      // Single value — treat as width
      if (style.WebkitTextStrokeWidth === undefined)
        style.WebkitTextStrokeWidth = parseValue(val);
    }
    delete style.WebkitTextStroke;
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

const BG_REPEAT_KEYWORDS = new Set([
  "repeat",
  "no-repeat",
  "repeat-x",
  "repeat-y",
  "space",
  "round",
]);
const BG_POSITION_KEYWORDS = new Set([
  "left",
  "right",
  "top",
  "bottom",
  "center",
]);
const BG_ATTACHMENT_KEYWORDS = new Set(["scroll", "fixed", "local"]);
const BG_BOX_KEYWORDS = new Set(["border-box", "padding-box", "content-box"]);
const BG_IMAGE_FN =
  /^(?:url|image-set|(?:repeating-)?(?:linear|radial|conic)-gradient)\(/;

// Whitespace-tokenize a CSS value, keeping balanced-paren blocks intact and
// emitting `/` as its own token (the position/size separator).
function tokenizeBackground(value: string): string[] {
  const tokens: string[] = [];
  let buf = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (c === "(") {
      let depth = 1;
      buf += c;
      i++;
      while (i < value.length && depth > 0) {
        const ch = value[i]!;
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        buf += ch;
        i++;
      }
      i--;
    } else if (/\s/.test(c)) {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
    } else if (c === "/") {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
      tokens.push("/");
    } else {
      buf += c;
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

interface BackgroundParts {
  image?: string;
  repeat?: string;
  size?: string;
  color?: string;
}

function parseLayer(value: string): BackgroundParts {
  const out: BackgroundParts = {};
  const sizeTokens: string[] = [];
  let afterSlash = false;
  for (const tok of tokenizeBackground(value)) {
    if (tok === "/") {
      afterSlash = true;
      continue;
    }
    if (afterSlash) {
      sizeTokens.push(tok);
      continue;
    }
    if (BG_IMAGE_FN.test(tok)) {
      out.image = tok;
      continue;
    }
    if (tok === "none") continue;
    if (BG_REPEAT_KEYWORDS.has(tok)) {
      out.repeat = tok;
      continue;
    }
    // Position/attachment/box/length tokens are recognized so they don't fall
    // through and get treated as colors; the renderer doesn't honor them yet.
    if (
      BG_POSITION_KEYWORDS.has(tok) ||
      BG_ATTACHMENT_KEYWORDS.has(tok) ||
      BG_BOX_KEYWORDS.has(tok) ||
      /^-?\d/.test(tok)
    ) {
      continue;
    }
    out.color = tok;
  }
  if (sizeTokens.length > 0) out.size = sizeTokens.join(" ");
  return out;
}

/**
 * Parse the CSS `background` shorthand into image/repeat/size/color longhands.
 * For multi-layer values, image is comma-joined and color is taken only from
 * the final layer (the only layer permitted a color per the CSS spec).
 */
export function parseBackgroundShorthand(value: string): BackgroundParts {
  const layers = splitGradientArgs(value).map((l) => l.trim());
  if (layers.length <= 1) return parseLayer(layers[0] ?? "");

  const parsed = layers.map(parseLayer);
  const out: BackgroundParts = {};
  const images = parsed.map((p) => p.image ?? "none");
  if (images.some((i) => i !== "none")) out.image = images.join(", ");
  for (const p of parsed) {
    if (p.repeat !== undefined && out.repeat === undefined)
      out.repeat = p.repeat;
    if (p.size !== undefined && out.size === undefined) out.size = p.size;
  }
  const finalColor = parsed[parsed.length - 1]?.color;
  if (finalColor !== undefined) out.color = finalColor;
  return out;
}
