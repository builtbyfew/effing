// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

/**
 * Style after shorthand expansion but before unit resolution.
 * Properties like fontSize may still contain CSS unit strings (e.g. "4em").
 */
export type ExpandedStyle = Omit<ComputedStyle, "fontSize"> & {
  fontSize?: number | string;
};

/**
 * Normalized, computed CSS style after shorthand expansion.
 * All dimension values are numbers (pixels) or percentage strings.
 */
export type ComputedStyle = {
  // Display & layout
  display?: "flex" | "none";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  alignSelf?:
    | "auto"
    | "flex-start"
    | "flex-end"
    | "center"
    | "stretch"
    | "baseline";
  alignContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "stretch"
    | "space-between"
    | "space-around";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;

  // Dimensions
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;

  // Position
  position?: "relative" | "absolute";
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;

  // Margin
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;

  // Padding
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;

  // Border
  borderTopWidth?: number | string;
  borderRightWidth?: number | string;
  borderBottomWidth?: number | string;
  borderLeftWidth?: number | string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderTopStyle?: string;
  borderRightStyle?: string;
  borderBottomStyle?: string;
  borderLeftStyle?: string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderBottomRightRadius?: number | string;
  borderBottomLeftRadius?: number | string;

  // Gap
  rowGap?: number;
  columnGap?: number;

  // Overflow
  overflow?: string;
  overflowX?: string;
  overflowY?: string;

  // Colors & background
  backgroundColor?: string;
  color?: string;
  opacity?: number;
  backgroundImage?: string;
  backgroundSize?: string;

  // Typography
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  lineHeight?: number | string;
  letterSpacing?: number | string;
  whiteSpace?: "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";
  wordBreak?: "normal" | "break-all" | "break-word" | "keep-all";
  textOverflow?: "clip" | "ellipsis";
  lineClamp?: number;

  // Box shadow
  boxShadow?: string;
  textShadow?: string;

  // Transform
  transform?: string;
  transformOrigin?: string;

  // Image
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";

  // Filter
  filter?: string;

  // Text box trim
  textBoxTrim?: "none" | "trim-start" | "trim-end" | "trim-both";
  textBoxEdge?: string;
};

const ROOT_FONT_SIZE = 16;

/**
 * Default styles for the root element.
 */
export const DEFAULT_STYLE: ComputedStyle = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  flexGrow: 0,
  flexShrink: 0,
  alignItems: "stretch",
  justifyContent: "flex-start",
  position: "relative",
  fontSize: ROOT_FONT_SIZE,
  fontWeight: 400,
  fontStyle: "normal",
  color: "black",
  lineHeight: "normal",
  textAlign: "left",
  whiteSpace: "normal",
  wordBreak: "normal",
  textOverflow: "clip",
  opacity: 1,
  overflow: "visible",
};

/**
 * CSS properties that are inherited by child elements.
 */
const INHERITABLE_PROPS: (keyof ComputedStyle)[] = [
  "color",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "textTransform",
  "textDecoration",
  "lineHeight",
  "letterSpacing",
  "whiteSpace",
  "wordBreak",
  "textOverflow",
  "lineClamp",
  "textBoxTrim",
  "textBoxEdge",
];

/**
 * Resolve the computed style for a node, inheriting from parent where appropriate.
 */
export function resolveStyle(
  rawStyle: ExpandedStyle | undefined,
  parentStyle: ComputedStyle,
): ComputedStyle {
  const style = { ...rawStyle };

  // Apply inherited properties
  for (const prop of INHERITABLE_PROPS) {
    if (style[prop] === undefined && parentStyle[prop] !== undefined) {
      (style as Record<string, unknown>)[prop] = parentStyle[prop];
    }
  }

  // Resolve fontSize (ensure it's a number, respecting em/rem/etc units)
  if (typeof style.fontSize === "string") {
    const parentFontSize =
      typeof parentStyle.fontSize === "number"
        ? parentStyle.fontSize
        : ROOT_FONT_SIZE;
    const resolved = resolveUnit(
      style.fontSize,
      0,
      0,
      parentFontSize,
      ROOT_FONT_SIZE,
    );
    style.fontSize = typeof resolved === "number" ? resolved : parentFontSize;
  }

  // Resolve lineHeight: parse string values to numbers but keep multipliers
  // as-is so they're recalculated per-element in text layout (using each
  // element's own fontSize rather than the parent's).
  if (typeof style.lineHeight === "string") {
    const str = style.lineHeight;
    if (str.endsWith("%")) {
      style.lineHeight = parseFloat(str) / 100;
    } else {
      const parsed = parseFloat(str);
      if (!isNaN(parsed)) {
        style.lineHeight = parsed;
      }
    }
  }

  // Resolve letterSpacing (respecting em/rem/etc units)
  if (typeof style.letterSpacing === "string") {
    const currentFontSize =
      typeof style.fontSize === "number"
        ? style.fontSize
        : typeof parentStyle.fontSize === "number"
          ? parentStyle.fontSize
          : ROOT_FONT_SIZE;
    const resolved = resolveUnit(
      style.letterSpacing,
      0,
      0,
      currentFontSize,
      ROOT_FONT_SIZE,
    );
    if (typeof resolved === "number") {
      style.letterSpacing = resolved;
    }
  }

  return style as ComputedStyle;
}

/**
 * Dimension properties that may contain CSS units needing resolution.
 */
const DIMENSION_PROPS: (keyof ComputedStyle)[] = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "top",
  "right",
  "bottom",
  "left",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "rowGap",
  "columnGap",
  "flexBasis",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
];

/**
 * Resolve a single CSS dimension string to a pixel number.
 * Returns the original value for `%` and `auto` (Yoga handles those),
 * and for values that are already numbers or unrecognised strings.
 */
function resolveUnit(
  value: string,
  viewportWidth: number,
  viewportHeight: number,
  fontSize: number,
  rootFontSize: number,
): number | string {
  // Percentages and auto are handled downstream by Yoga
  if (value.endsWith("%") || value === "auto") return value;

  // Viewport-relative units
  if (value.endsWith("vmin")) {
    const n = parseFloat(value);
    return isNaN(n)
      ? value
      : (n / 100) * Math.min(viewportWidth, viewportHeight);
  }
  if (value.endsWith("vmax")) {
    const n = parseFloat(value);
    return isNaN(n)
      ? value
      : (n / 100) * Math.max(viewportWidth, viewportHeight);
  }
  if (value.endsWith("vw")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : (n / 100) * viewportWidth;
  }
  if (value.endsWith("vh")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : (n / 100) * viewportHeight;
  }

  // Font-relative units
  if (value.endsWith("rem")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * rootFontSize;
  }
  if (value.endsWith("em")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * fontSize;
  }

  // Absolute units (CSS reference pixel = 1/96 inch)
  if (value.endsWith("px")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n;
  }
  if (value.endsWith("pt")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * (96 / 72);
  }
  if (value.endsWith("pc")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * 16;
  }
  if (value.endsWith("in")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * 96;
  }
  if (value.endsWith("cm")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * (96 / 2.54);
  }
  if (value.endsWith("mm")) {
    const n = parseFloat(value);
    return isNaN(n) ? value : n * (96 / 25.4);
  }

  return value;
}

/**
 * Resolve CSS units (vw, vh, vmin, vmax, em, rem, px, pt, pc, in, cm, mm)
 * in a style object to pixel values. Percentages and `auto` pass through
 * unchanged for Yoga to handle.
 */
export function resolveUnits(
  style: ComputedStyle,
  viewportWidth: number,
  viewportHeight: number,
  rootFontSize: number = ROOT_FONT_SIZE,
): ComputedStyle {
  const fontSize =
    typeof style.fontSize === "number" ? style.fontSize : rootFontSize;

  for (const prop of DIMENSION_PROPS) {
    const value = style[prop];
    if (typeof value !== "string") continue;
    const resolved = resolveUnit(
      value,
      viewportWidth,
      viewportHeight,
      fontSize,
      rootFontSize,
    );
    if (resolved !== value) {
      (style as Record<string, unknown>)[prop] = resolved;
    }
  }

  // Resolve CSS length units inside transform strings so that by draw time
  // values are either bare numbers or `%` (which need element dimensions).
  if (style.transform) {
    style.transform = resolveTransformUnits(
      style.transform,
      viewportWidth,
      viewportHeight,
      fontSize,
      rootFontSize,
    );
  }
  if (style.transformOrigin) {
    style.transformOrigin = resolveTransformUnits(
      style.transformOrigin,
      viewportWidth,
      viewportHeight,
      fontSize,
      rootFontSize,
    );
  }

  return style;
}

/**
 * Resolve CSS length units (vw, vh, em, rem, px, etc.) inside a transform or
 * transformOrigin string. Percentages and angle units (deg, rad, turn) are
 * left untouched — percentages need element dimensions (available at draw time)
 * and angle units are not lengths.
 */
function resolveTransformUnits(
  transform: string,
  viewportWidth: number,
  viewportHeight: number,
  fontSize: number,
  rootFontSize: number,
): string {
  return transform.replace(
    /(-?\d*\.?\d+)(vw|vh|vmin|vmax|em|rem|px|pt|pc|in|cm|mm)\b/g,
    (match) => {
      const resolved = resolveUnit(
        match,
        viewportWidth,
        viewportHeight,
        fontSize,
        rootFontSize,
      );
      return typeof resolved === "number" ? String(resolved) : match;
    },
  );
}

/**
 * Resolve a dimension value (width, height, margin, etc.) to pixels.
 * Percentage values are resolved relative to the provided container size.
 */
export function resolveDimension(
  value: number | string | undefined,
  containerSize: number,
): number | undefined {
  if (value === undefined || value === "auto") return undefined;
  if (typeof value === "number") return value;
  const s = String(value);
  if (s.endsWith("%")) {
    return (parseFloat(s) / 100) * containerSize;
  }
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}
