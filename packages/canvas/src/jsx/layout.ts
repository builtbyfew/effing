// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { ReactElement, ReactNode } from "react";

import type { ImageCache } from "../image.ts";
import { cachedLoadImage } from "../image.ts";
import type { RenderContext } from "./context.ts";
import { expandStyle } from "./style/expand.ts";
import {
  resolveStyle,
  resolveUnit,
  resolveUnits,
  DEFAULT_STYLE,
} from "./style/compute.ts";
import type { ComputedStyle } from "./style/compute.ts";
import { applyStylesToYoga, toLayoutUnit } from "./style/properties.ts";
import { TextMeasure } from "./text/index.ts";
import { isWhiteSpaceOnly } from "./text/white-space.ts";
import type { TextContent } from "./text/white-space.ts";
import type { TextLayoutResult } from "./text/index.ts";
import {
  createTextYogaNode,
  createYogaNode,
  freeYogaNode,
  Edge,
  FlexDirection,
  MeasureMode,
  Unit,
  Wrap,
} from "./yoga.ts";
import type { YogaNode } from "./yoga.ts";

/**
 * A node in the computed layout tree, ready for drawing.
 */
export type LayoutNode = {
  type: string;
  style: ComputedStyle;
  children: LayoutNode[];
  textContent?: TextContent;
  /** The text laid out at the node's width, for drawing. */
  textLayout?: TextLayoutResult;
  props: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Build a layout tree from a React element tree.
 * Creates Yoga nodes, calculates layout, and returns the positioned tree.
 *
 * @param element - React element tree to lay out
 * @param containerWidth - Width of the container (from canvas)
 * @param containerHeight - Height of the container (from canvas)
 * @returns Root layout node with computed positions and dimensions
 */
export async function buildLayoutTree(
  element: ReactNode,
  containerWidth: number,
  containerHeight: number,
  emojiEnabled?: boolean,
  fontFamilies?: string[],
  context?: RenderContext,
): Promise<{ tree: LayoutNode; imageCache: ImageCache }> {
  const renderContext: RenderContext = context ?? {
    imageCache: new Map(),
    debug: false,
  };
  const rootElement = renderComponents(element);
  const elementYogaNode = isText(rootElement)
    ? createTextYogaNode()
    : createYogaNode();

  // Set font families as default on root style so all nodes inherit them
  const rootStyle = fontFamilies?.length
    ? { ...DEFAULT_STYLE, fontFamily: fontFamilies.join(", ") }
    : DEFAULT_STYLE;

  // Build the tree
  const elementNode = await buildNode(
    rootElement,
    rootStyle,
    elementYogaNode,
    containerWidth,
    containerHeight,
    emojiEnabled,
    fontFamilies,
    renderContext,
  );

  // Wrap the user element in a canvas-sized container (like Satori) so that
  // absolute positioning, percentage sizes, etc. resolve against the canvas.
  const rootYogaNode = createYogaNode();
  rootYogaNode.setWidth(containerWidth);
  rootYogaNode.setHeight(containerHeight);
  rootYogaNode.setFlexDirection(FlexDirection.Row);
  rootYogaNode.insertChild(elementYogaNode, 0);

  // The layout is computed once, and normally once more for text items it
  // squeezed below their minimums. At worst, `layOut` computes it
  // 1 + MAX_AUTO_MINIMUM_RELAYOUTS = 5 times, and `settleText` calls it
  // MAX_TEXT_RELAYOUTS + 1 = 3 times more: 20 layouts a round, for the first
  // round, MAX_RUNAWAY_RELAYOUTS = 2 rounds of pinned runaway items and one
  // with minimums lifted, 80 in all.
  let layouts = 0;
  const compute = () => {
    layouts++;
    rootYogaNode.calculateLayout(containerWidth, containerHeight);
  };

  // Text items get their automatic minimum widths (in a column, heights)
  // where the layout squeezes them below their text, which takes another
  // layout, and their text is laid out at the widths they end up with.
  const autoMinimums = collectAutoMinimums(elementNode);
  const layOut = () => {
    compute();
    for (
      let pass = 0;
      pass < MAX_AUTO_MINIMUM_RELAYOUTS && enforceAutoMinimums(autoMinimums);
      pass++
    ) {
      compute();
    }
  };
  layOut();
  settleText(elementNode, layOut, renderContext.debug);

  // Yoga can lose its sums and size flex items out of all proportion (see
  // `findRunawayItems`): pin them at their minimums, as CSS sizes them, or
  // failing that, lay the text in their lines out without its automatic
  // minimums.
  const limit = RUNAWAY_SIZE * Math.max(containerWidth, containerHeight);
  for (let pass = 0; pass < MAX_RUNAWAY_RELAYOUTS; pass++) {
    const runaway = findRunawayItems(elementNode, limit);
    if (runaway.length === 0) break;
    for (const item of runaway) pinAtMinimum(item);
    layOut();
    settleText(elementNode, layOut, renderContext.debug);
  }
  const runaway = findRunawayItems(elementNode, limit);
  if (runaway.length > 0) {
    const lines = new Set(runaway.map((item) => item.parent));
    const lifted = [...lines]
      .flatMap((line) => line.children)
      .filter((node) => node.autoMinimum && liftAutoMinimum(node));
    if (lifted.length > 0) {
      layOut();
      settleText(elementNode, layOut, renderContext.debug);
    }
    if (renderContext.debug) {
      console.warn(
        "[@effing/canvas] Yoga sized flex items out of all proportion" +
          (lifted.length > 0 ? ": laid their text out without minimums" : ""),
      );
    }
  }
  if (renderContext.debug && layouts > 5) {
    console.warn(`[@effing/canvas] computed the layout ${layouts} times`);
  }

  const elementLayout = extractLayout(elementNode, elementYogaNode);
  freeYogaNode(rootYogaNode);

  const tree: LayoutNode = {
    type: "div",
    style: rootStyle,
    children: [elementLayout],
    props: {},
    x: 0,
    y: 0,
    width: containerWidth,
    height: containerHeight,
  };
  return { tree, imageCache: renderContext.imageCache };
}

/**
 * Build the node for `element` on `yogaNode`. Function components must be
 * rendered first (`renderComponents`), so the caller can make text a text
 * node (`createTextYogaNode`).
 */
async function buildNode(
  element: ReactNode | TextRun,
  parentStyle: ComputedStyle,
  yogaNode: YogaNode,
  viewportWidth: number,
  viewportHeight: number,
  emojiEnabled?: boolean,
  fontFamilies?: string[],
  context?: RenderContext,
): Promise<IntermediateNode> {
  // Handle null/undefined/boolean
  if (
    element === null ||
    element === undefined ||
    typeof element === "boolean"
  ) {
    return {
      type: "empty",
      style: parentStyle,
      children: [],
      props: {},
      yogaNode,
    };
  }

  // Handle text/number primitives, and runs of text
  if (isText(element) || isTextRun(element)) {
    const text = isTextRun(element) ? textContentOf(element) : String(element);
    return buildTextNode(text, parentStyle, yogaNode, emojiEnabled);
  }

  // Handle React elements (host elements: components are rendered already)
  const el = element as ReactElement<Record<string, unknown>>;
  const type = el.type;

  const props = (el.props ?? {}) as Record<string, unknown>;
  const rawStyle = (props.style ?? {}) as Record<string, unknown>;
  const expanded = expandStyle(rawStyle, fontFamilies);
  const style = resolveStyle(expanded, parentStyle);
  resolveUnits(style, viewportWidth, viewportHeight);

  const tagName = String(type);

  // For <svg> elements, merge width/height props into style when not set via CSS
  if (tagName === "svg") {
    if (props.width != null && style.width === undefined) {
      const v = props.width;
      if (typeof v === "string") {
        const resolved = resolveUnit(v, viewportWidth, viewportHeight, 16, 16);
        style.width =
          typeof resolved === "string" && resolved.endsWith("%")
            ? resolved
            : Number(resolved);
      } else {
        style.width = Number(v);
      }
    }
    if (props.height != null && style.height === undefined) {
      const v = props.height;
      if (typeof v === "string") {
        const resolved = resolveUnit(v, viewportWidth, viewportHeight, 16, 16);
        style.height =
          typeof resolved === "string" && resolved.endsWith("%")
            ? resolved
            : Number(resolved);
      } else {
        style.height = Number(v);
      }
    }

    // Derive missing dimension from viewBox aspect ratio
    const viewBox = props.viewBox as string | undefined;
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        const [, , vbW, vbH] = parts as [number, number, number, number];
        if (vbW > 0 && vbH > 0) {
          const wSet = style.width !== undefined;
          const hSet = style.height !== undefined;
          if (!wSet && !hSet) {
            style.width = vbW;
            style.height = vbH;
          } else if (!hSet && typeof style.width === "number") {
            style.height = style.width * (vbH / vbW);
          } else if (!wSet && typeof style.height === "number") {
            style.width = style.height * (vbW / vbH);
          }
          // When either/both are %, leave as-is for Yoga
        }
      }
    }
  }

  // For <img> elements, derive missing dimensions from intrinsic aspect ratio
  if (tagName === "img") {
    // Map HTML width/height attributes to style (like <svg>)
    if (props.width != null && style.width === undefined) {
      const v = props.width;
      style.width = typeof v === "string" && v.endsWith("%") ? v : Number(v);
    }
    if (props.height != null && style.height === undefined) {
      const v = props.height;
      style.height = typeof v === "string" && v.endsWith("%") ? v : Number(v);
    }

    const src = props.src as string | Buffer | undefined;
    if (src) {
      try {
        const image = await cachedLoadImage(
          context?.imageCache ?? new Map(),
          src,
          context?.userAgent,
        );
        const naturalW = image.width;
        const naturalH = image.height;

        const wSet = style.width !== undefined;
        const hSet = style.height !== undefined;

        if (naturalW > 0 && naturalH > 0 && !(wSet && hSet)) {
          if (!wSet && !hSet) {
            // No dimensions given — fill parent, let aspect ratio derive height.
            style.width = "100%";
          }
          yogaNode.setAspectRatio(naturalW / naturalH);
        }
      } catch (err) {
        // Don't fail layout when the image is unreachable — render at whatever
        // size Yoga computes. Surface the error (only in debug) so misconfigured
        // URLs and UA-gated CDNs are diagnosable instead of silently dropping
        // pixels, without spamming logs on every frame of a normal render.
        if (context?.debug) {
          const id = Buffer.isBuffer(src) ? "<Buffer>" : src;
          console.warn(
            `[@effing/canvas] failed to load image for layout (${id}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  // Apply styles to Yoga node
  applyStylesToYoga(yogaNode, style);

  // SVG containers: children use SVG coordinate space, not flex layout.
  // Skip Yoga child nodes and keep React children in props for the SVG drawer.
  if (tagName === "svg") {
    const resolvedChildren = resolveSvgTree(props.children as ReactNode);
    return {
      type: tagName,
      style,
      children: [],
      props: { ...props, children: resolvedChildren },
      yogaNode,
    };
  }

  // The children as the DOM has them: components rendered, fragments and
  // arrays unwrapped, and adjacent text and <br>s one run. Text of nothing but
  // white space is no flex item at all (see below).
  const items = flattenChildren(props.children as ReactNode).filter(
    (item) => !isTextRun(item) || !isBlankRun(item),
  );

  // If this node has only text content, create a child text node.
  // Using a child node (instead of setMeasureFunc on this node directly)
  // ensures Yoga's baseline calculation accounts for this node's padding/border
  // when a parent uses alignItems: "baseline". A node whose only text is white
  // space has no line box.
  const onlyText = items.length === 1 && isTextRun(items[0]) ? items[0] : null;
  if (onlyText !== null) {
    const childYogaNode = createTextYogaNode();
    const child = buildTextNode(
      textContentOf(onlyText),
      style,
      childYogaNode,
      emojiEnabled,
    );
    const jc = style.justifyContent;
    if (!jc || jc === "flex-start") {
      childYogaNode.setFlexGrow(1);
    }
    childYogaNode.setFlexShrink(1);
    yogaNode.insertChild(childYogaNode, 0);

    // Match satori: text-only nodes default to flexShrink=1 so they shrink to
    // fit the available flex space. Without this, text containers overflow their
    // flex parent when siblings consume part of the main axis.
    if (style.flexShrink === undefined) {
      yogaNode.setFlexShrink(1);
    }
    // But no narrower than their text, as CSS has it, nor in a column shorter
    // than its lines: the element, and its text in the element's own line.
    const textMeasure = child.textMeasure!;
    child.autoMinimum = {
      textMeasure,
      column: !isRow(style),
      text: childYogaNode,
    };

    return {
      type: tagName,
      style,
      children: [child],
      props,
      yogaNode,
      autoMinimum: hasAutoMinimum(style, parentStyle)
        ? {
            textMeasure,
            style,
            column: !isRow(parentStyle),
            text: childYogaNode,
          }
        : undefined,
    };
  }

  // Process children. Each run of text and <br>s between other elements is a
  // flex item of its own (CSS Flexbox §4), its white space collapsed as its
  // box's text (see `layoutText`): the spaces at its start and end, and
  // around a <br>, are removed. A run of nothing but white space isn't
  // rendered at all, whatever its `white-space`.
  const children: IntermediateNode[] = [];
  for (const rendered of items) {
    const childYogaNode = isTextRun(rendered)
      ? createTextYogaNode()
      : createYogaNode();
    yogaNode.insertChild(childYogaNode, children.length);
    children.push(
      await buildNode(
        rendered,
        style,
        childYogaNode,
        viewportWidth,
        viewportHeight,
        emojiEnabled,
        fontFamilies,
        context,
      ),
    );
  }

  return {
    type: tagName,
    style,
    children,
    props,
    yogaNode,
  };
}

type IntermediateNode = {
  type: string;
  style: ComputedStyle;
  children: IntermediateNode[];
  textContent?: TextContent;
  /** Set on text nodes, which Yoga measures. */
  textMeasure?: TextMeasure;
  /**
   * Set on a flex item that CSS gives an automatic minimum size (see
   * `enforceAutoMinimums`).
   */
  autoMinimum?: AutoMinimum;
  props: Record<string, unknown>;
  yogaNode: YogaNode;
};

/**
 * How many times the layout is computed again for text that Yoga sized at
 * another width than it's drawn at (see `TextMeasure`). One normally settles
 * it; the bound is for layouts where a node's width depends on its height
 * (wrapping columns, aspect ratios), which could otherwise keep changing.
 */
const MAX_TEXT_RELAYOUTS = 2;

/**
 * Lay every text node out at its final width, and compute the layout again
 * while Yoga sized one from a different height.
 */
function settleText(
  root: IntermediateNode,
  relayout: () => void,
  debug: boolean,
): void {
  const textNodes: IntermediateNode[] = [];
  const collect = (node: IntermediateNode) => {
    // Nothing under `display: none` is laid out or drawn.
    if (node.style.display === "none") return;
    if (node.textMeasure) textNodes.push(node);
    node.children.forEach(collect);
  };
  collect(root);
  // Text nodes have no padding or border: their width is the content's.
  const settle = (node: IntermediateNode, pin: boolean) =>
    node.textMeasure!.settle(node.yogaNode.getComputedWidth(), pin);

  for (let pass = 0; pass < MAX_TEXT_RELAYOUTS; pass++) {
    let unsettled = false;
    for (const node of textNodes) {
      if (settle(node, true)) {
        node.yogaNode.markDirty();
        unsettled = true;
      }
    }
    if (!unsettled) return;
    relayout();
  }
  if (!textNodes.some((node) => settle(node, false))) return;

  // Each pin moved the layout on to widths the drawn heights don't fit. Go
  // back to Yoga's own layout, as without the pins, and draw the text at the
  // widths it gives.
  for (const node of textNodes) {
    if (node.textMeasure!.unpin()) node.yogaNode.markDirty();
  }
  relayout();
  const unsettled = textNodes.filter((node) => settle(node, false)).length;
  if (debug && unsettled > 0) {
    console.warn(
      `[@effing/canvas] ${unsettled} text node(s) sized for other lines ` +
        `than drawn: the layout didn't settle in ${MAX_TEXT_RELAYOUTS} relayouts`,
    );
  }
}

/** Build a text node for `text` on `yogaNode`, which Yoga measures. */
function buildTextNode(
  text: TextContent,
  parentStyle: ComputedStyle,
  yogaNode: YogaNode,
  emojiEnabled?: boolean,
): IntermediateNode {
  const style = resolveStyle(undefined, parentStyle);
  const textMeasure = new TextMeasure(text, style, emojiEnabled);
  setTextMeasure(yogaNode, textMeasure);
  return {
    type: "text",
    style,
    children: [],
    textContent: text,
    textMeasure,
    props: {},
    yogaNode,
  };
}

/** Whether a flex container lays its items out in a row. */
const isRow = (style: ComputedStyle) =>
  style.flexDirection === undefined ||
  style.flexDirection === "row" ||
  style.flexDirection === "row-reverse";

/**
 * A flex item that holds nothing but text, which CSS's automatic minimum
 * size keeps from shrinking below its text. In a row, `min-width: auto`
 * keeps it as wide as the text's min-content width: a word, or a line that
 * can't wrap. That keeps text that doesn't fit centred in a centring parent,
 * overflowing it on both sides, as in Chrome. In a column, `min-height: auto`
 * keeps it as tall as the text's lines at its width, which overflow the
 * column rather than the item. The text of such an element is an item in
 * the element's own line, with a minimum of its own.
 */
type AutoMinimum = {
  textMeasure: TextMeasure;
  /** The element's style; none for its text. */
  style?: ComputedStyle;
  /** Whether the item is in a column, and its minimum a height. */
  column: boolean;
  /** The text's node, at whose width the text is laid out. */
  text: YogaNode;
  /** Takes back the minimum given to Yoga, once it was. */
  lift?: () => void;
  /**
   * The minimum height given to Yoga, which follows the text's width (in a
   * column, where the item's flex basis doesn't).
   */
  held?: number;
  /** Set once the minimum is lifted for good (see `buildLayoutTree`). */
  lifted?: boolean;
};

/**
 * Whether an element that holds nothing but text has an automatic minimum
 * size along its parent's main axis. A scroll container (`overflow: hidden`,
 * `scroll` or `auto`) has none, as in CSS, nor has an item positioned
 * absolutely or one with a `min-width` (in a column, `min-height`) of its
 * own.
 */
function hasAutoMinimum(
  style: ComputedStyle,
  parentStyle: ComputedStyle,
): boolean {
  const min = isRow(parentStyle) ? style.minWidth : style.minHeight;
  return (
    style.position !== "absolute" &&
    (min === undefined || min === "auto") &&
    ![style.overflow, style.overflowX, style.overflowY].some(
      (overflow) =>
        overflow === "hidden" || overflow === "scroll" || overflow === "auto",
    )
  );
}

/**
 * How many times the layout is computed again for items squeezed below
 * their automatic minimum width. Each minimum given can squeeze the items
 * next to it in turn.
 */
const MAX_AUTO_MINIMUM_RELAYOUTS = 4;

/** The nodes with an automatic minimum width, but under `display: none`. */
function collectAutoMinimums(root: IntermediateNode): IntermediateNode[] {
  const nodes: IntermediateNode[] = [];
  const collect = (node: IntermediateNode) => {
    if (node.style.display === "none") return;
    if (node.autoMinimum) nodes.push(node);
    node.children.forEach(collect);
  };
  collect(root);
  return nodes;
}

/**
 * Hold each item Yoga laid out narrower (in a column, shorter) than its
 * automatic minimum at that minimum (see `holdAtMinimum`), for the caller to
 * compute the layout again.
 *
 * Only the items that need it are held: a minimum Yoga doesn't hold an item
 * to doesn't change the layout, and these are the items CSS freezes at their
 * minimums. Holding them can squeeze the items next to them below theirs in
 * turn, as CSS freezes items in rounds.
 *
 * @returns Whether any item was held, or held at another minimum
 */
function enforceAutoMinimums(nodes: IntermediateNode[]): boolean {
  let enforced = false;
  for (const node of nodes) {
    const autoMinimum = node.autoMinimum!;
    if (autoMinimum.lifted) continue;
    if (autoMinimum.column) {
      if (enforceAutoMinimumHeight(node)) enforced = true;
      continue;
    }
    if (autoMinimum.lift) continue;
    const { yogaNode } = node;
    const { textMeasure, style } = autoMinimum;
    const width = yogaNode.getComputedWidth();
    // Yoga puts elements on whole pixels; text it leaves as measured.
    const tolerance = style ? 1 : 1e-3;
    // As wide as a bound on its minimum: not squeezed.
    const edges = style ? horizontalEdges(yogaNode, style) : 0;
    if (width + tolerance >= textMeasure.minContentBound + edges) continue;
    const minimum = autoMinimumWidth(node);
    if (minimum === undefined || width + tolerance >= minimum) continue;
    autoMinimum.lift = holdAtMinimum(yogaNode, minimum, {
      atBasis:
        textMeasure.unbreakable &&
        (!style || (isAuto(style.width) && isAuto(style.flexBasis))),
      // The text in an element sizes the element's own flex basis, which a
      // pin would take from it.
      pin: style !== undefined,
      column: false,
    });
    enforced = true;
  }
  return enforced;
}

/**
 * Hold an item in a column that Yoga laid out shorter than its text at its
 * width at that height (`min-height: auto`), or hold it at the height its
 * text has now, where its width changed since it was held.
 *
 * @returns Whether the item was held, or held at another minimum
 */
function enforceAutoMinimumHeight(node: IntermediateNode): boolean {
  const autoMinimum = node.autoMinimum!;
  const { yogaNode } = node;
  const { style } = autoMinimum;
  const minimum = autoMinimumHeight(node);
  if (minimum === undefined) return false;
  // Yoga puts elements on whole pixels, which takes less than a pixel off
  // their heights; text it leaves as measured. Held a little early, an
  // element is held a fraction of a pixel taller than it was.
  const tolerance = style ? 0.5 : 1e-3;
  // An item whose flex basis is its text's height (`atBasis`) follows the
  // text's height: it only stops shrinking.
  const atBasis = !style || (isAuto(style.height) && isAuto(style.flexBasis));
  if (autoMinimum.lift) {
    if (atBasis || Math.abs(autoMinimum.held! - minimum) < tolerance) {
      return false;
    }
    autoMinimum.lift();
  } else if (yogaNode.getComputedHeight() + tolerance >= minimum) {
    return false;
  }
  autoMinimum.held = minimum;
  autoMinimum.lift = holdAtMinimum(yogaNode, minimum, {
    atBasis,
    pin: style !== undefined,
    column: true,
  });
  return true;
}

const isAuto = (
  value: number | string | undefined,
): value is undefined | "auto" => value === undefined || value === "auto";

/**
 * A node's padding and borders on the left and right, as Yoga has them, or
 * as its style has them where they're lengths.
 */
function horizontalEdges(yogaNode: YogaNode, style?: ComputedStyle): number {
  const lengths = style && [
    style.paddingLeft,
    style.paddingRight,
    style.borderLeftWidth,
    style.borderRightWidth,
  ];
  if (lengths?.every((v) => v === undefined || typeof v === "number")) {
    return lengths.reduce<number>(
      (sum, v) => sum + toLayoutUnit((v as number | undefined) ?? 0),
      0,
    );
  }
  return (
    yogaNode.getComputedPadding(Edge.Left) +
    yogaNode.getComputedPadding(Edge.Right) +
    yogaNode.getComputedBorder(Edge.Left) +
    yogaNode.getComputedBorder(Edge.Right)
  );
}

/**
 * A node's automatic minimum width: its text's min-content width, and an
 * element's padding and borders, capped at its width and max width as CSS
 * does, a percentage of its parent's content box.
 *
 * @returns The minimum, or undefined where a width can't be resolved
 */
function autoMinimumWidth(node: IntermediateNode): number | undefined {
  const { yogaNode } = node;
  const { textMeasure, style } = node.autoMinimum!;
  if (!style) return textMeasure.minContentWidth;
  const parent = yogaNode.getParent();
  return capped(
    textMeasure.minContentWidth + horizontalEdges(yogaNode, style),
    [style.width, style.maxWidth],
    parent ? parent.getComputedWidth() - horizontalEdges(parent) : NaN,
  );
}

/**
 * A node's automatic minimum height in a column: the height of its text's
 * lines at the text's width, and an element's padding and borders, capped
 * at its height and max height as CSS does, a percentage of its parent's
 * content box.
 *
 * @returns The minimum, or undefined where a height can't be resolved
 */
function autoMinimumHeight(node: IntermediateNode): number | undefined {
  const { yogaNode } = node;
  const { textMeasure, style, text } = node.autoMinimum!;
  const height = textMeasure.heightAt(text.getComputedWidth());
  if (!style) return height;
  const parent = yogaNode.getParent();
  return capped(
    height + verticalEdges(yogaNode),
    [style.height, style.maxHeight],
    parent ? parent.getComputedHeight() - verticalEdges(parent) : NaN,
  );
}

/**
 * `minimum` capped at the sizes given, a percentage of `parentContentSize`.
 *
 * @returns The minimum, or undefined where a size can't be resolved
 */
function capped(
  minimum: number,
  sizes: (number | string | undefined)[],
  parentContentSize: number,
): number | undefined {
  for (const value of sizes) {
    if (isAuto(value)) continue;
    let cap: number;
    if (typeof value === "number") {
      cap = toLayoutUnit(value);
    } else if (value.endsWith("%") && Number.isFinite(parentContentSize)) {
      cap = (parseFloat(value) / 100) * parentContentSize;
    } else {
      return undefined;
    }
    if (!Number.isFinite(cap)) return undefined;
    minimum = Math.min(minimum, cap);
  }
  return minimum;
}

/** A node's padding and borders at the top and bottom, as Yoga has them. */
const verticalEdges = (yogaNode: YogaNode): number =>
  yogaNode.getComputedPadding(Edge.Top) +
  yogaNode.getComputedPadding(Edge.Bottom) +
  yogaNode.getComputedBorder(Edge.Top) +
  yogaNode.getComputedBorder(Edge.Bottom);

/**
 * Hold a flex item Yoga squeezed below its automatic minimum width (in a
 * column, height) at that minimum, as CSS does: it freezes an item at its
 * minimum when it would shrink below it, and lays the others out in the
 * space left.
 *
 * An item whose flex basis is its minimum already (`atBasis`) only stops
 * shrinking. An element in a line that doesn't wrap (`pin`) is pinned at
 * its minimum (a flex basis of it, and neither growing nor shrinking),
 * which leaves it out of the items Yoga flexes. A min width would keep it
 * in, and when every item Yoga shrinks in a line is held at its minimum,
 * Yoga can lose its sums (see `findRunawayItems`), or size them from their
 * flex bases. Other items get a min width: one in a line that wraps, where
 * its flex basis decides which line it's on, and the text in an element,
 * the only item in its line, whose flex basis is the element's.
 *
 * @returns A function that takes the minimum back
 */
function holdAtMinimum(
  yogaNode: YogaNode,
  minimum: number,
  { atBasis, pin, column }: { atBasis: boolean; pin: boolean; column: boolean },
): () => void {
  const flexShrink = yogaNode.getFlexShrink();
  if (atBasis) {
    yogaNode.setFlexShrink(0);
    return () => yogaNode.setFlexShrink(flexShrink);
  }
  const wraps = yogaNode.getParent()?.getFlexWrap() !== Wrap.NoWrap;
  if (!pin || wraps) {
    const setMin = (value: number | undefined) =>
      column ? yogaNode.setMinHeight(value) : yogaNode.setMinWidth(value);
    setMin(minimum);
    return () => setMin(undefined);
  }
  const flexGrow = yogaNode.getFlexGrow();
  const flexBasis = yogaNode.getFlexBasis();
  yogaNode.setFlexBasis(minimum);
  yogaNode.setFlexShrink(0);
  yogaNode.setFlexGrow(0);
  return () => {
    yogaNode.setFlexShrink(flexShrink);
    yogaNode.setFlexGrow(flexGrow);
    if (flexBasis.unit === Unit.Point) yogaNode.setFlexBasis(flexBasis.value);
    else if (flexBasis.unit === Unit.Percent)
      yogaNode.setFlexBasis(`${flexBasis.value}%`);
    else yogaNode.setFlexBasis("auto");
  };
}

/**
 * Take back the automatic minimum width given to Yoga, for good.
 *
 * @returns Whether there was one
 */
function liftAutoMinimum(node: IntermediateNode): boolean {
  const autoMinimum = node.autoMinimum!;
  const { lift } = autoMinimum;
  lift?.();
  autoMinimum.lift = undefined;
  autoMinimum.lifted = true;
  return lift !== undefined;
}

/**
 * A node this many times as wide or tall as the canvas is taken for one
 * Yoga lost its sums for.
 */
const RUNAWAY_SIZE = 100;

/** How many times runaway flex items are pinned, and the layout computed. */
const MAX_RUNAWAY_RELAYOUTS = 2;

const isRunaway = (size: number, limit: number) => !(Math.abs(size) <= limit);

/** A flex item Yoga sized out of all proportion, in its parent's line. */
type RunawayItem = {
  node: IntermediateNode;
  parent: IntermediateNode;
  /** Whether the parent's main axis is horizontal. */
  row: boolean;
};

/**
 * The flex items Yoga shrank to a runaway size: larger than `limit` (or NaN)
 * along their parent's main axis, in a parent that isn't.
 *
 * Yoga shrinks flex items in float32. When every item it shrinks in a line
 * is held at its minimum (its min width, or its padding and borders), the
 * shrink factors it sums and takes away again can leave a rounding error
 * behind, which it then divides by: the items grow to millions of pixels.
 * Lengths and text widths on a grid of 1/64px keep those sums exact, but
 * percentages, shares of free space and fractional `flexShrink`s aren't.
 * Only an item that can shrink is taken for one: a wide item that doesn't
 * is as wide as it says.
 */
function findRunawayItems(
  root: IntermediateNode,
  limit: number,
): RunawayItem[] {
  const items: RunawayItem[] = [];
  const visit = (node: IntermediateNode, parent?: IntermediateNode) => {
    if (node.style.display === "none") return;
    const { yogaNode } = node;
    if (parent) {
      const row = [FlexDirection.Row, FlexDirection.RowReverse].includes(
        parent.yogaNode.getFlexDirection(),
      );
      const size = (n: YogaNode) =>
        row ? n.getComputedWidth() : n.getComputedHeight();
      if (
        yogaNode.getFlexShrink() > 0 &&
        isRunaway(size(yogaNode), limit) &&
        !isRunaway(size(parent.yogaNode), limit)
      ) {
        // Its children follow it.
        items.push({ node, parent, row });
        return;
      }
    }
    for (const child of node.children) visit(child, node);
  };
  visit(root);
  return items;
}

/**
 * Pin a runaway item at its minimum, as CSS holds every item in such a line:
 * a flex basis of the minimum, and no shrinking.
 */
function pinAtMinimum({ node, parent, row }: RunawayItem): void {
  const { yogaNode } = node;
  // Its automatic minimum too, which Yoga may not have yet.
  const autoMinimum = node.autoMinimum;
  const auto =
    autoMinimum && autoMinimum.column !== row
      ? row
        ? autoMinimumWidth(node)
        : autoMinimumHeight(node)
      : 0;
  yogaNode.setFlexBasis(
    Math.max(minimumSize(yogaNode, parent.yogaNode, row), auto ?? 0),
  );
  yogaNode.setFlexShrink(0);
}

/**
 * The size a flex item can't shrink below along its parent's main axis: its
 * min width or height, and its padding and borders.
 */
function minimumSize(
  yogaNode: YogaNode,
  parent: YogaNode,
  row: boolean,
): number {
  const [start, end] = row ? [Edge.Left, Edge.Right] : [Edge.Top, Edge.Bottom];
  const edges = (node: YogaNode) =>
    node.getComputedPadding(start) +
    node.getComputedPadding(end) +
    node.getComputedBorder(start) +
    node.getComputedBorder(end);
  const min = row ? yogaNode.getMinWidth() : yogaNode.getMinHeight();
  let minimum = 0;
  if (min.unit === Unit.Point) {
    minimum = min.value;
  } else if (min.unit === Unit.Percent) {
    const parentSize = row
      ? parent.getComputedWidth()
      : parent.getComputedHeight();
    minimum = (min.value / 100) * (parentSize - edges(parent));
  }
  return Math.max(minimum, edges(yogaNode));
}

/** Measure `yogaNode` with `textMeasure`. */
function setTextMeasure(yogaNode: YogaNode, textMeasure: TextMeasure): void {
  yogaNode.setMeasureFunc((width, widthMode) =>
    widthMode === MeasureMode.Undefined || Number.isNaN(width)
      ? textMeasure.measure(Infinity)
      : textMeasure.measure(width, widthMode === MeasureMode.Exactly),
  );
}

const isText = (node: unknown): node is string | number =>
  typeof node === "string" || typeof node === "number";

/** Render function components until something else is left. */
function renderComponents(node: ReactNode): ReactNode {
  while (
    node !== null &&
    typeof node === "object" &&
    "type" in node &&
    typeof node.type === "function"
  ) {
    const el = node as ReactElement<Record<string, unknown>>;
    node = (el.type as (props: Record<string, unknown>) => ReactNode)(
      el.props ?? {},
    );
  }
  return node;
}

/**
 * A run of adjacent text and `<br>`s, which a browser lays out as one
 * anonymous flex item: the pieces of text between the `<br>`s, one more than
 * there are `<br>`s.
 */
class TextRun {
  readonly pieces: string[];

  constructor(...pieces: string[]) {
    this.pieces = pieces;
  }
}

const isTextRun = (node: unknown): node is TextRun => node instanceof TextRun;

/** A run's text, as a string when there's no `<br>` in it. */
const textContentOf = (run: TextRun): TextContent =>
  run.pieces.length === 1 ? run.pieces[0]! : run.pieces;

/** Whether a run is nothing but white space, with no `<br>` either. */
const isBlankRun = (run: TextRun): boolean =>
  run.pieces.length === 1 && isWhiteSpaceOnly(run.pieces[0]!);

/** A child as the DOM has it: an element, or a run of text. */
type Item = ReactNode | TextRun;

/**
 * The children as the DOM has them: function components rendered, fragments
 * and arrays unwrapped, null, undefined and booleans left out, and adjacent
 * text, as `Hello {name}` or a fragment of text gives, merged into one run,
 * with the `<br>`s between it, which are forced breaks in that run, as in
 * the browser. A `<br>` that isn't displayed is left out.
 */
function flattenChildren(node: ReactNode, items: Item[] = []): Item[] {
  const rendered = renderComponents(node);
  if (
    rendered === null ||
    rendered === undefined ||
    typeof rendered === "boolean"
  ) {
    return items;
  }
  if (Array.isArray(rendered)) {
    for (const child of rendered as ReactNode[]) flattenChildren(child, items);
    return items;
  }
  const el = rendered as ReactElement<{ children?: ReactNode }>;
  if (typeof rendered === "object" && (el.type as unknown) === REACT_FRAGMENT) {
    return flattenChildren(el.props?.children, items);
  }
  const last = items[items.length - 1];
  if (isText(rendered)) {
    if (isTextRun(last)) {
      last.pieces[last.pieces.length - 1] += String(rendered);
    } else {
      items.push(new TextRun(String(rendered)));
    }
  } else if (!isBreak(rendered)) {
    items.push(rendered);
  } else if (!isHidden(rendered)) {
    if (isTextRun(last)) last.pieces.push("");
    else items.push(new TextRun("", ""));
  }
  return items;
}

const isBreak = (node: ReactNode): node is ReactElement<{ style?: unknown }> =>
  typeof node === "object" &&
  node !== null &&
  (node as ReactElement).type === "br";

const isHidden = (el: ReactElement<{ style?: unknown }>): boolean =>
  (el.props.style as { display?: unknown } | undefined)?.display === "none";

/** Floor to a whole pixel, as Yoga does text (snapping values within 1e-4). */
function floorToPixel(value: number): number {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 1e-4 ? rounded : Math.floor(value);
}

function extractLayout(node: IntermediateNode, yogaNode: YogaNode): LayoutNode {
  const layout = yogaNode.getComputedLayout();
  // Yoga leaves text nodes unrounded (see `createTextYogaNode`) for their
  // width; they're placed on whole pixels, floored as Yoga rounds text.
  const place = node.textMeasure ? floorToPixel : (v: number) => v;

  return {
    type: node.type,
    style: node.style,
    children: node.children.map((child, i) => {
      const childYoga = yogaNode.getChild(i);
      return extractLayout(child, childYoga);
    }),
    textContent: node.textContent,
    textLayout: node.textMeasure?.layout,
    props: node.props,
    x: place(layout.left),
    y: place(layout.top),
    width: layout.width,
    height: layout.height,
  };
}

/**
 * React's `Fragment` type. A registered symbol shared by all React copies,
 * so we can detect fragments without a runtime dependency on `react`.
 */
const REACT_FRAGMENT = Symbol.for("react.fragment");

/**
 * Resolve function components, unwrap fragments, and flatten nested arrays
 * inside an `<svg>` subtree. The SVG drawer switches on primitive element
 * strings (path, rect, etc.) and does not flatten its own children, so
 * without this preprocessing (a) function components and fragments silently
 * disappear and (b) helpers returning arrays crash the defs collector.
 */
function resolveSvgTree(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean")
    return null;
  if (typeof node === "string" || typeof node === "number") return node;

  if (Array.isArray(node)) {
    const out: ReactNode[] = [];
    let changed = false;
    for (const child of node as ReactNode[]) {
      const resolved = resolveSvgTree(child);
      if (resolved === null || resolved === undefined) {
        changed = true;
        continue;
      }
      if (Array.isArray(resolved)) {
        changed = true;
        for (const r of resolved) out.push(r);
      } else {
        if (resolved !== child) changed = true;
        out.push(resolved);
      }
    }
    return changed ? out : node;
  }

  const el = node as ReactElement<Record<string, unknown>>;
  if (typeof el.type === "function") {
    const rendered = (el.type as (props: Record<string, unknown>) => ReactNode)(
      el.props ?? {},
    );
    return resolveSvgTree(rendered);
  }

  // Unwrap fragments: their children take the fragment's place in the parent
  // (callers flatten arrays), since the drawer only knows SVG element strings.
  if ((el.type as unknown) === REACT_FRAGMENT) {
    return resolveSvgTree((el.props ?? {}).children as ReactNode);
  }

  const elProps = (el.props ?? {}) as Record<string, unknown>;
  if (elProps.children !== undefined) {
    const resolvedChildren = resolveSvgTree(elProps.children as ReactNode);
    if (resolvedChildren !== elProps.children) {
      return { ...el, props: { ...elProps, children: resolvedChildren } };
    }
  }
  return el;
}
