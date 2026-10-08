import type { TextLayoutResult } from "./text/index.ts";
import {
  Align,
  Display,
  Edge,
  FlexDirection,
  PositionType,
  Unit,
  Wrap,
  floorToPixel,
} from "./yoga.ts";
import type { YogaNode } from "./yoga.ts";

/** A node of the layout tree, as baseline alignment reads it. */
export type BaselineNode = {
  yogaNode: YogaNode;
  /** In the order of the Yoga node's children. */
  children: BaselineNode[];
  /** Set on text nodes, with the text as laid out at the node's width. */
  textMeasure?: { readonly layout?: TextLayoutResult };
};

/**
 * How many times the layout is computed again to align items by their
 * baselines. Each pass aligns the items of rows nested one deeper than the
 * last, whose boxes, and baselines, the alignment of their own items moved.
 */
const MAX_BASELINE_RELAYOUTS = 4;

/** An item that a row aligns by its baseline. */
type Item = {
  node: BaselineNode;
  /** Its own top margin, in px. */
  margin: number;
  /**
   * In a row that wraps, its own offset down (`top`, or `bottom` upwards),
   * in px: Yoga puts an item at the top of a wrapped line by it alone,
   * leaving its top margin out, so the margin goes into the offset there.
   */
  offset?: number;
  /** The margin added above it, to put its baseline on its line's. */
  shift: number;
};

/** A row that aligns some of its items by their baselines. */
type Row = {
  node: BaselineNode;
  /** Its items in flow, the ones aligned by their baselines among them. */
  inFlow: BaselineNode[];
  reverse: boolean;
  wraps: boolean;
  items: Map<BaselineNode, Item>;
};

/**
 * Align the items of each row with `alignItems: "baseline"` (or
 * `alignSelf: "baseline"`) by their first baselines, as CSS does.
 *
 * Yoga's JS binding has no baseline function: Yoga takes the baseline of a
 * node without children for its bottom edge, so it would align text by its
 * box's bottom. Instead, after a layout, each item aligned by its baseline
 * sits at the top of its line (`flex-start`), below a margin that puts its
 * baseline on the line's: the lowest baseline of the items aligned in it, as
 * far below each item's top margin edge as CSS has it. A line is then as
 * tall as CSS makes it, the deepest descent below that baseline included.
 *
 * An item's baseline is that of its text's first line, or, for an element,
 * as Yoga and CSS have it: that of its first item on its first line that is
 * aligned by its baseline, or else of its first item (absolutely positioned
 * ones left out), below the item's top. A box with no items has its bottom
 * edge for a baseline.
 *
 * @param relayout - Computes the layout again, for the margins given
 */
export function alignBaselines(root: BaselineNode, relayout: () => void): void {
  const rows: Row[] = [];
  const aligned = new Set<BaselineNode>();
  collectRows(root, rows, aligned);
  if (rows.length === 0) return;

  for (const row of rows) {
    const { yogaNode } = row.node;
    if (yogaNode.getAlignItems() === Align.Baseline) {
      yogaNode.setAlignItems(Align.FlexStart);
    }
    for (const node of row.inFlow) {
      if (!aligned.has(node)) continue;
      node.yogaNode.setAlignSelf(Align.FlexStart);
      row.items.set(node, {
        node,
        margin: node.yogaNode.getComputedMargin(Edge.Top),
        offset: row.wraps ? offsetOf(node.yogaNode) : undefined,
        // Yoga laid the items out by its own baselines: lay them out again.
        shift: NaN,
      });
    }
  }

  for (let pass = 0; pass < MAX_BASELINE_RELAYOUTS; pass++) {
    let moved = false;
    for (const row of rows) {
      for (const line of linesOf(row)) {
        const items = line
          .map((node) => row.items.get(node))
          .filter((item) => item !== undefined);
        const ascents = items.map(
          (item) => item.margin + baselineOf(item.node, aligned),
        );
        const baseline = Math.max(...ascents);
        items.forEach((item, i) => {
          const shift = baseline - ascents[i]!;
          if (Math.abs(shift - item.shift) < 1e-3) return;
          item.shift = shift;
          const { yogaNode } = item.node;
          yogaNode.setMargin(Edge.Top, item.margin + shift);
          if (item.offset !== undefined) {
            yogaNode.setPosition(Edge.Top, item.offset + item.margin + shift);
          }
          moved = true;
        });
      }
    }
    if (!moved) return;
    relayout();
  }
}

/** Whether a flex container lays its items out in a row. */
const isRow = (yogaNode: YogaNode) => {
  const direction = yogaNode.getFlexDirection();
  return (
    direction === FlexDirection.Row || direction === FlexDirection.RowReverse
  );
};

/** The children of a node that are laid out as its flex items. */
const inFlowOf = (node: BaselineNode) =>
  node.children.filter(
    (child) =>
      child.yogaNode.getDisplay() !== Display.None &&
      child.yogaNode.getPositionType() !== PositionType.Absolute,
  );

/**
 * An item's offset down, in px, from its `top`, or its `bottom` upwards;
 * undefined for a percentage.
 */
function offsetOf(yogaNode: YogaNode): number | undefined {
  for (const [edge, sign] of [
    [Edge.Top, 1],
    [Edge.Bottom, -1],
  ] as const) {
    const { unit, value } = yogaNode.getPosition(edge);
    if (unit === Unit.Point) return sign * value;
    if (unit !== Unit.Undefined) return undefined;
  }
  return 0;
}

/**
 * Find the rows that align items by their baselines, and the items each one
 * aligns so (`aligned`), as Yoga resolves their alignment: a column aligns
 * none. An item with an auto margin above or below it isn't aligned, as in
 * CSS, nor are the items of a row that wraps in reverse, nor, in a row that
 * wraps, one offset by a percentage (see `Item.offset`).
 */
function collectRows(
  node: BaselineNode,
  rows: Row[],
  aligned: Set<BaselineNode>,
): void {
  const { yogaNode } = node;
  if (yogaNode.getDisplay() === Display.None) return;
  const wrap = yogaNode.getFlexWrap();
  if (isRow(yogaNode) && wrap !== Wrap.WrapReverse) {
    const inFlow = inFlowOf(node);
    const alignItems = yogaNode.getAlignItems();
    let any = false;
    for (const child of inFlow) {
      const alignSelf = child.yogaNode.getAlignSelf();
      const align = alignSelf === Align.Auto ? alignItems : alignSelf;
      const autoMargin = [Edge.Top, Edge.Bottom, Edge.Vertical, Edge.All].some(
        (edge) => child.yogaNode.getMargin(edge).unit === Unit.Auto,
      );
      const offset = wrap === Wrap.Wrap ? offsetOf(child.yogaNode) : 0;
      if (align === Align.Baseline && !autoMargin && offset !== undefined) {
        aligned.add(child);
        any = true;
      }
    }
    if (any) {
      rows.push({
        node,
        inFlow,
        reverse: yogaNode.getFlexDirection() === FlexDirection.RowReverse,
        wraps: wrap === Wrap.Wrap,
        items: new Map(),
      });
    }
  }
  for (const child of node.children) collectRows(child, rows, aligned);
}

/**
 * A row's items in flow, by line: where a row wraps, a line starts where an
 * item goes back to the start of the row from where the last one was.
 */
function linesOf(row: Row): BaselineNode[][] {
  if (!row.wraps) return [row.inFlow];
  const lines: BaselineNode[][] = [];
  let last: number | undefined;
  for (const node of row.inFlow) {
    const left = node.yogaNode.getComputedLeft();
    const back =
      last !== undefined &&
      (row.reverse ? left > last + 0.5 : left < last - 0.5);
    if (lines.length === 0 || back) lines.push([]);
    lines[lines.length - 1]!.push(node);
    last = left;
  }
  return lines;
}

/** The node's first baseline, below its top edge (see `alignBaselines`). */
function baselineOf(node: BaselineNode, aligned: Set<BaselineNode>): number {
  const { yogaNode } = node;
  if (node.textMeasure) {
    const first = node.textMeasure.layout?.segments[0];
    if (first) return first.y;
  }
  const items = firstLineOf(node);
  const child = items.find((item) => aligned.has(item)) ?? items[0];
  if (!child) return yogaNode.getComputedHeight();
  // Yoga leaves text unrounded; it's drawn floored to whole pixels.
  const top = child.textMeasure
    ? floorToPixel(child.yogaNode.getComputedTop())
    : child.yogaNode.getComputedTop();
  return top + baselineOf(child, aligned);
}

/**
 * A node's items in flow on its first line: in a column, its first item, as
 * a column aligns none by its baseline.
 */
function firstLineOf(node: BaselineNode): BaselineNode[] {
  const inFlow = inFlowOf(node);
  const { yogaNode } = node;
  if (!isRow(yogaNode)) return inFlow.slice(0, 1);
  if (yogaNode.getFlexWrap() === Wrap.NoWrap) return inFlow;
  const [first = []] = linesOf({
    node,
    inFlow,
    reverse: yogaNode.getFlexDirection() === FlexDirection.RowReverse,
    wraps: true,
    items: new Map(),
  });
  return first;
}
