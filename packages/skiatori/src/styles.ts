import {
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Wrap,
} from "yoga-layout/load";
import type { Node as YogaNode } from "yoga-layout/load";
import type { Style } from "./types.ts";

// ---------------------------------------------------------------------------
// Yoga enum maps
// ---------------------------------------------------------------------------

const FLEX_DIRECTION: Record<string, FlexDirection> = {
  row: FlexDirection.Row,
  "row-reverse": FlexDirection.RowReverse,
  column: FlexDirection.Column,
  "column-reverse": FlexDirection.ColumnReverse,
};

const ALIGN: Record<string, Align> = {
  auto: Align.Auto,
  "flex-start": Align.FlexStart,
  center: Align.Center,
  "flex-end": Align.FlexEnd,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
  "space-between": Align.SpaceBetween,
  "space-around": Align.SpaceAround,
  "space-evenly": Align.SpaceEvenly,
};

const JUSTIFY: Record<string, Justify> = {
  "flex-start": Justify.FlexStart,
  center: Justify.Center,
  "flex-end": Justify.FlexEnd,
  "space-between": Justify.SpaceBetween,
  "space-around": Justify.SpaceAround,
  "space-evenly": Justify.SpaceEvenly,
};

const WRAP_MAP: Record<string, Wrap> = {
  nowrap: Wrap.NoWrap,
  wrap: Wrap.Wrap,
  "wrap-reverse": Wrap.WrapReverse,
};

const OVERFLOW_MAP: Record<string, Overflow> = {
  visible: Overflow.Visible,
  hidden: Overflow.Hidden,
  scroll: Overflow.Scroll,
};

const POSITION_MAP: Record<string, PositionType> = {
  static: PositionType.Static,
  relative: PositionType.Relative,
  absolute: PositionType.Absolute,
};

const DISPLAY_MAP: Record<string, Display> = {
  flex: Display.Flex,
  none: Display.None,
  contents: Display.Contents,
};

// ---------------------------------------------------------------------------
// Dimension helpers
// ---------------------------------------------------------------------------

type DimValue = number | `${number}%` | "auto" | undefined;

function dim(v: unknown): DimValue {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const s = String(v);
  if (s === "auto") return "auto";
  if (s.endsWith("%")) return s as `${number}%`;
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

function dimNoAuto(v: unknown): number | `${number}%` | undefined {
  const d = dim(v);
  return d === "auto" ? undefined : d;
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? undefined : n;
}

function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}

// ---------------------------------------------------------------------------
// Shorthand expansion
// ---------------------------------------------------------------------------

type EdgeValues = {
  top: unknown;
  right: unknown;
  bottom: unknown;
  left: unknown;
};

function expandEdges(
  style: Style,
  prop: string,
  topKey: string,
  rightKey: string,
  bottomKey: string,
  leftKey: string,
): EdgeValues {
  return {
    top: style[topKey] ?? style[prop],
    right: style[rightKey] ?? style[prop],
    bottom: style[bottomKey] ?? style[prop],
    left: style[leftKey] ?? style[prop],
  };
}

// ---------------------------------------------------------------------------
// Apply style to yoga node
// ---------------------------------------------------------------------------

export function applyStylesToYogaNode(yogaNode: YogaNode, style: Style): void {
  // Display
  const display = str(style.display);
  if (display && display in DISPLAY_MAP) {
    yogaNode.setDisplay(DISPLAY_MAP[display]);
  }

  // Flex direction
  const fd = str(style.flexDirection);
  if (fd && fd in FLEX_DIRECTION) yogaNode.setFlexDirection(FLEX_DIRECTION[fd]);

  // Flex wrap
  const fw = str(style.flexWrap);
  if (fw && fw in WRAP_MAP) yogaNode.setFlexWrap(WRAP_MAP[fw]);

  // Alignment
  const ai = str(style.alignItems);
  if (ai && ai in ALIGN) yogaNode.setAlignItems(ALIGN[ai]);
  const as = str(style.alignSelf);
  if (as && as in ALIGN) yogaNode.setAlignSelf(ALIGN[as]);
  const ac = str(style.alignContent);
  if (ac && ac in ALIGN) yogaNode.setAlignContent(ALIGN[ac]);
  const jc = str(style.justifyContent);
  if (jc && jc in JUSTIFY) yogaNode.setJustifyContent(JUSTIFY[jc]);

  // Flex properties
  const fg = num(style.flexGrow);
  if (fg != null) yogaNode.setFlexGrow(fg);
  const fs = num(style.flexShrink);
  if (fs != null) yogaNode.setFlexShrink(fs);
  const fb = dim(style.flexBasis);
  if (fb != null) yogaNode.setFlexBasis(fb);

  // Dimensions
  const w = dim(style.width);
  if (w != null) yogaNode.setWidth(w);
  const h = dim(style.height);
  if (h != null) yogaNode.setHeight(h);
  const minW = dimNoAuto(style.minWidth);
  if (minW != null) yogaNode.setMinWidth(minW);
  const minH = dimNoAuto(style.minHeight);
  if (minH != null) yogaNode.setMinHeight(minH);
  const maxW = dimNoAuto(style.maxWidth);
  if (maxW != null) yogaNode.setMaxWidth(maxW);
  const maxH = dimNoAuto(style.maxHeight);
  if (maxH != null) yogaNode.setMaxHeight(maxH);

  // Padding
  const pad = expandEdges(
    style,
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  );
  const pt = dimNoAuto(pad.top);
  if (pt != null) yogaNode.setPadding(Edge.Top, pt);
  const pr = dimNoAuto(pad.right);
  if (pr != null) yogaNode.setPadding(Edge.Right, pr);
  const pb = dimNoAuto(pad.bottom);
  if (pb != null) yogaNode.setPadding(Edge.Bottom, pb);
  const pl = dimNoAuto(pad.left);
  if (pl != null) yogaNode.setPadding(Edge.Left, pl);

  // Margin
  const mar = expandEdges(
    style,
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
  );
  const mt = dim(mar.top);
  if (mt != null) yogaNode.setMargin(Edge.Top, mt);
  const mr = dim(mar.right);
  if (mr != null) yogaNode.setMargin(Edge.Right, mr);
  const mb = dim(mar.bottom);
  if (mb != null) yogaNode.setMargin(Edge.Bottom, mb);
  const ml = dim(mar.left);
  if (ml != null) yogaNode.setMargin(Edge.Left, ml);

  // Gap
  const gap = dimNoAuto(style.gap);
  if (gap != null) yogaNode.setGap(Gutter.All, gap);
  const rg = dimNoAuto(style.rowGap);
  if (rg != null) yogaNode.setGap(Gutter.Row, rg);
  const cg = dimNoAuto(style.columnGap);
  if (cg != null) yogaNode.setGap(Gutter.Column, cg);

  // Position
  const pos = str(style.position);
  if (pos && pos in POSITION_MAP) yogaNode.setPositionType(POSITION_MAP[pos]);
  const top = dimNoAuto(style.top);
  if (top != null) yogaNode.setPosition(Edge.Top, top);
  const right = dimNoAuto(style.right);
  if (right != null) yogaNode.setPosition(Edge.Right, right);
  const bottom = dimNoAuto(style.bottom);
  if (bottom != null) yogaNode.setPosition(Edge.Bottom, bottom);
  const left = dimNoAuto(style.left);
  if (left != null) yogaNode.setPosition(Edge.Left, left);

  // Overflow
  const ov = str(style.overflow);
  if (ov && ov in OVERFLOW_MAP) yogaNode.setOverflow(OVERFLOW_MAP[ov]);

  // Border width (used for layout)
  const bw = num(style.borderWidth);
  if (bw != null) {
    yogaNode.setBorder(Edge.All, bw);
  }
  const bwt = num(style.borderTopWidth);
  if (bwt != null) yogaNode.setBorder(Edge.Top, bwt);
  const bwr = num(style.borderRightWidth);
  if (bwr != null) yogaNode.setBorder(Edge.Right, bwr);
  const bwb = num(style.borderBottomWidth);
  if (bwb != null) yogaNode.setBorder(Edge.Bottom, bwb);
  const bwl = num(style.borderLeftWidth);
  if (bwl != null) yogaNode.setBorder(Edge.Left, bwl);
}

// ---------------------------------------------------------------------------
// Build a CSS font shorthand string from style props
// ---------------------------------------------------------------------------

export function buildFontString(style: Style): string {
  const fontStyle = str(style.fontStyle) ?? "normal";
  const fontWeight = String(style.fontWeight ?? 400);
  const fontSize = num(style.fontSize) ?? 16;
  const fontFamily = str(style.fontFamily) ?? "sans-serif";
  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

// ---------------------------------------------------------------------------
// Text measurement helper — called from layout phase
// ---------------------------------------------------------------------------

export type MeasureTextFn = (
  text: string,
  style: Style,
  maxWidth: number | undefined,
) => { width: number; height: number };

export { MeasureMode };
