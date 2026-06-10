import {
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Overflow,
  PositionType,
  Wrap,
} from "../yoga.ts";
import type { YogaNode } from "../yoga.ts";
import type { ComputedStyle } from "./compute.ts";

/**
 * Apply computed CSS styles to a Yoga node.
 */
export function applyStylesToYoga(node: YogaNode, style: ComputedStyle): void {
  // Display
  if (style.display === "none") {
    node.setDisplay(Display.None);
  } else {
    node.setDisplay(Display.Flex);
  }

  // Flex direction (CSS default is "row", Yoga defaults to "column")
  {
    const map: Record<string, FlexDirection> = {
      row: FlexDirection.Row,
      "row-reverse": FlexDirection.RowReverse,
      column: FlexDirection.Column,
      "column-reverse": FlexDirection.ColumnReverse,
    };
    node.setFlexDirection(
      map[style.flexDirection ?? "row"] ?? FlexDirection.Row,
    );
  }

  // Justify content
  if (style.justifyContent) {
    const map: Record<string, Justify> = {
      "flex-start": Justify.FlexStart,
      "flex-end": Justify.FlexEnd,
      center: Justify.Center,
      "space-between": Justify.SpaceBetween,
      "space-around": Justify.SpaceAround,
      "space-evenly": Justify.SpaceEvenly,
    };
    const jc = map[style.justifyContent];
    if (jc !== undefined) node.setJustifyContent(jc);
  }

  // Align items.
  // NOTE: `baseline` does NOT produce typographic baseline alignment. The
  // bundled yoga-layout JS binding exposes no baseline function, so Yoga falls
  // back to a node's height as its baseline — which aligns box bottoms (the
  // same result as `flex-end`), correct only when all children share a font
  // size. The README documents this limitation; don't re-advertise it as full
  // baseline support without a real fix, since the engine can't express it.
  if (style.alignItems) {
    const map: Record<string, Align> = {
      "flex-start": Align.FlexStart,
      "flex-end": Align.FlexEnd,
      center: Align.Center,
      stretch: Align.Stretch,
      baseline: Align.Baseline,
    };
    const ai = map[style.alignItems];
    if (ai !== undefined) node.setAlignItems(ai);
  }

  // Align self (`baseline` carries the same box-bottom caveat as alignItems)
  if (style.alignSelf) {
    const map: Record<string, Align> = {
      auto: Align.Auto,
      "flex-start": Align.FlexStart,
      "flex-end": Align.FlexEnd,
      center: Align.Center,
      stretch: Align.Stretch,
      baseline: Align.Baseline,
    };
    const as_ = map[style.alignSelf];
    if (as_ !== undefined) node.setAlignSelf(as_);
  }

  // Align content
  if (style.alignContent) {
    const map: Record<string, Align> = {
      "flex-start": Align.FlexStart,
      "flex-end": Align.FlexEnd,
      center: Align.Center,
      stretch: Align.Stretch,
      "space-between": Align.SpaceBetween,
      "space-around": Align.SpaceAround,
    };
    const ac = map[style.alignContent];
    if (ac !== undefined) node.setAlignContent(ac);
  }

  // Flex wrap
  if (style.flexWrap) {
    const map: Record<string, Wrap> = {
      nowrap: Wrap.NoWrap,
      wrap: Wrap.Wrap,
      "wrap-reverse": Wrap.WrapReverse,
    };
    const fw = map[style.flexWrap];
    if (fw !== undefined) node.setFlexWrap(fw);
  }

  // Flex grow / shrink / basis
  if (style.flexGrow !== undefined) node.setFlexGrow(style.flexGrow);
  // Satori defaults flexShrink to 0 (React Native convention); match it for compatibility
  node.setFlexShrink(style.flexShrink ?? 0);
  if (style.flexBasis !== undefined) {
    if (typeof style.flexBasis === "number") {
      node.setFlexBasis(style.flexBasis);
    } else if (String(style.flexBasis).endsWith("%")) {
      node.setFlexBasis(String(style.flexBasis) as `${number}%`);
    } else if (style.flexBasis === "auto") {
      node.setFlexBasis("auto");
    } else {
      const n = parseFloat(String(style.flexBasis));
      if (!isNaN(n)) node.setFlexBasis(n);
    }
  }

  // Dimensions
  applyDimension(node, "setWidth", style.width);
  applyDimension(node, "setHeight", style.height);
  applyDimension(node, "setMinWidth", style.minWidth);
  applyDimension(node, "setMinHeight", style.minHeight);
  applyDimension(node, "setMaxWidth", style.maxWidth);
  applyDimension(node, "setMaxHeight", style.maxHeight);

  // Position
  if (style.position === "absolute") {
    node.setPositionType(PositionType.Absolute);
  } else {
    node.setPositionType(PositionType.Relative);
  }

  // Position edges
  applyEdgeValue(node, "setPosition", Edge.Top, style.top);
  applyEdgeValue(node, "setPosition", Edge.Right, style.right);
  applyEdgeValue(node, "setPosition", Edge.Bottom, style.bottom);
  applyEdgeValue(node, "setPosition", Edge.Left, style.left);

  // Margin
  applyEdgeValue(node, "setMargin", Edge.Top, style.marginTop);
  applyEdgeValue(node, "setMargin", Edge.Right, style.marginRight);
  applyEdgeValue(node, "setMargin", Edge.Bottom, style.marginBottom);
  applyEdgeValue(node, "setMargin", Edge.Left, style.marginLeft);

  // Padding
  applyEdgeValue(node, "setPadding", Edge.Top, style.paddingTop);
  applyEdgeValue(node, "setPadding", Edge.Right, style.paddingRight);
  applyEdgeValue(node, "setPadding", Edge.Bottom, style.paddingBottom);
  applyEdgeValue(node, "setPadding", Edge.Left, style.paddingLeft);

  // Border width (resolved to numbers by resolveUnits before this point)
  if (style.borderTopWidth !== undefined)
    node.setBorder(Edge.Top, style.borderTopWidth as number);
  if (style.borderRightWidth !== undefined)
    node.setBorder(Edge.Right, style.borderRightWidth as number);
  if (style.borderBottomWidth !== undefined)
    node.setBorder(Edge.Bottom, style.borderBottomWidth as number);
  if (style.borderLeftWidth !== undefined)
    node.setBorder(Edge.Left, style.borderLeftWidth as number);

  // Gap
  if (style.rowGap !== undefined) node.setGap(Gutter.Row, style.rowGap);
  if (style.columnGap !== undefined)
    node.setGap(Gutter.Column, style.columnGap);

  // Overflow
  if (
    style.overflow === "hidden" ||
    style.overflowX === "hidden" ||
    style.overflowY === "hidden"
  ) {
    node.setOverflow(Overflow.Hidden);
  } else {
    node.setOverflow(Overflow.Visible);
  }
}

function applyDimension(
  node: YogaNode,
  setter:
    | "setWidth"
    | "setHeight"
    | "setMinWidth"
    | "setMinHeight"
    | "setMaxWidth"
    | "setMaxHeight",
  value: number | string | undefined,
): void {
  if (value === undefined) return;
  if (value === "auto") {
    if (setter === "setWidth" || setter === "setHeight") {
      node[setter]("auto");
    }
    return;
  }
  if (typeof value === "number") {
    node[setter](value);
    return;
  }
  const s = String(value);
  if (s.endsWith("%")) {
    node[setter](s as `${number}%`);
  } else {
    const n = parseFloat(s);
    if (!isNaN(n)) node[setter](n);
  }
}

function applyEdgeValue(
  node: YogaNode,
  setter: "setMargin" | "setPadding" | "setPosition",
  edge: Edge,
  value: number | string | undefined,
): void {
  if (value === undefined) return;
  if (value === "auto" && setter === "setMargin") {
    node.setMargin(edge, "auto");
    return;
  }
  if (typeof value === "number") {
    node[setter](edge, value);
    return;
  }
  const s = String(value);
  if (s.endsWith("%")) {
    node[setter](edge, s as `${number}%`);
  } else {
    const n = parseFloat(s);
    if (!isNaN(n)) node[setter](edge, n);
  }
}
