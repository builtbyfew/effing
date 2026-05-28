// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { SKRSContext2D } from "@napi-rs/canvas";
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
import { applyStylesToYoga } from "./style/properties.ts";
import { createTextMeasureFunc } from "./text/index.ts";
import { createYogaNode, freeYogaNode, FlexDirection } from "./yoga.ts";
import type { YogaNode } from "./yoga.ts";

/**
 * A node in the computed layout tree, ready for drawing.
 */
export type LayoutNode = {
  type: string;
  style: ComputedStyle;
  children: LayoutNode[];
  textContent?: string;
  props: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ElementChild = string | number | ReactElement | null | undefined | boolean;

/**
 * Build a layout tree from a React element tree.
 * Creates Yoga nodes, calculates layout, and returns the positioned tree.
 *
 * @param element - React element tree to lay out
 * @param containerWidth - Width of the container (from canvas)
 * @param containerHeight - Height of the container (from canvas)
 * @param ctx - Canvas context for text measurement
 * @returns Root layout node with computed positions and dimensions
 */
export async function buildLayoutTree(
  element: ReactNode,
  containerWidth: number,
  containerHeight: number,
  ctx?: SKRSContext2D,
  emojiEnabled?: boolean,
  fontFamilies?: string[],
  context?: RenderContext,
): Promise<{ tree: LayoutNode; imageCache: ImageCache }> {
  const renderContext: RenderContext = context ?? {
    imageCache: new Map(),
    debug: false,
  };
  const elementYogaNode = createYogaNode();

  // Set font families as default on root style so all nodes inherit them
  const rootStyle = fontFamilies?.length
    ? { ...DEFAULT_STYLE, fontFamily: fontFamilies.join(", ") }
    : DEFAULT_STYLE;

  // Build the tree
  const elementNode = await buildNode(
    element,
    rootStyle,
    elementYogaNode,
    containerWidth,
    containerHeight,
    ctx,
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

  rootYogaNode.calculateLayout(containerWidth, containerHeight);

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

async function buildNode(
  element: ReactNode,
  parentStyle: ComputedStyle,
  yogaNode: YogaNode,
  viewportWidth: number,
  viewportHeight: number,
  ctx?: SKRSContext2D,
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

  // Handle text/number primitives
  if (typeof element === "string" || typeof element === "number") {
    const text = String(element);
    const style = resolveStyle(undefined, parentStyle);

    // Set up text measurement
    const measureFunc = createTextMeasureFunc(text, style, ctx, emojiEnabled);
    yogaNode.setMeasureFunc(measureFunc);

    return {
      type: "text",
      style,
      children: [],
      textContent: text,
      props: {},
      yogaNode,
    };
  }

  // Handle React elements
  const el = element as ReactElement<Record<string, unknown>>;
  const type = el.type;

  // Expand function/class components
  if (typeof type === "function") {
    const rendered = (type as (props: Record<string, unknown>) => ReactNode)(
      el.props ?? {},
    );
    return await buildNode(
      rendered,
      parentStyle,
      yogaNode,
      viewportWidth,
      viewportHeight,
      ctx,
      emojiEnabled,
      fontFamilies,
      context,
    );
  }

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

  // Collect text content from direct string children
  const textContent = extractTextContent(props.children);

  // If this node has only text content, create a child text node.
  // Using a child node (instead of setMeasureFunc on this node directly)
  // ensures Yoga's baseline calculation accounts for this node's padding/border
  // when a parent uses alignItems: "baseline".
  if (textContent !== undefined && !hasElementChildren(props.children)) {
    const childStyle = resolveStyle(undefined, style);
    const childYogaNode = createYogaNode();
    const measureFunc = createTextMeasureFunc(
      textContent,
      childStyle,
      ctx,
      emojiEnabled,
    );
    childYogaNode.setMeasureFunc(measureFunc);
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

    return {
      type: tagName,
      style,
      children: [
        {
          type: "text",
          style: childStyle,
          children: [],
          textContent,
          props: {},
          yogaNode: childYogaNode,
        },
      ],
      props,
      yogaNode,
    };
  }

  // Process children
  const children: IntermediateNode[] = [];
  const rawChildren = props.children;

  if (rawChildren !== undefined && rawChildren !== null) {
    const childArray = Array.isArray(rawChildren)
      ? rawChildren.flat(Infinity)
      : [rawChildren];

    // CSS Text 3 §4.1.1: collapse leading whitespace after a forced break
    const ws = style.whiteSpace;
    const collapsesWhitespace =
      ws === undefined ||
      ws === "normal" ||
      ws === "nowrap" ||
      ws === "pre-line";
    let prevWasBr = false;

    for (const child of childArray as ElementChild[]) {
      if (child === null || child === undefined || typeof child === "boolean")
        continue;

      let processedChild: ElementChild = child;
      if (prevWasBr && collapsesWhitespace && typeof child === "string") {
        processedChild = child.trimStart();
      }

      prevWasBr = isBrElement(child);

      const childYogaNode = createYogaNode();
      yogaNode.insertChild(childYogaNode, children.length);
      children.push(
        await buildNode(
          processedChild,
          style,
          childYogaNode,
          viewportWidth,
          viewportHeight,
          ctx,
          emojiEnabled,
          fontFamilies,
          context,
        ),
      );
    }
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
  textContent?: string;
  props: Record<string, unknown>;
  yogaNode: YogaNode;
};

function extractLayout(node: IntermediateNode, yogaNode: YogaNode): LayoutNode {
  const layout = yogaNode.getComputedLayout();

  return {
    type: node.type,
    style: node.style,
    children: node.children.map((child, i) => {
      const childYoga = yogaNode.getChild(i);
      return extractLayout(child, childYoga);
    }),
    textContent: node.textContent,
    props: node.props,
    x: layout.left,
    y: layout.top,
    width: layout.width,
    height: layout.height,
  };
}

/**
 * Extract plain text content from children if they are all strings/numbers.
 */
function isBrElement(child: unknown): boolean {
  if (child === null || child === undefined || typeof child !== "object")
    return false;
  return (child as ReactElement).type === "br";
}

function extractTextContent(children: unknown): string | undefined {
  if (children === undefined || children === null) return undefined;
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);

  if (Array.isArray(children)) {
    const parts: string[] = [];
    for (const child of children) {
      if (typeof child === "string") {
        parts.push(child);
      } else if (typeof child === "number") {
        parts.push(String(child));
      } else if (
        child !== null &&
        child !== undefined &&
        typeof child !== "boolean"
      ) {
        return undefined; // Mixed content — not pure text
      }
    }
    return parts.join("");
  }

  return undefined;
}

/**
 * Resolve function components and flatten nested arrays inside an `<svg>`
 * subtree. The SVG drawer switches on primitive element strings (path, rect,
 * etc.) and does not flatten its own children, so without this preprocessing
 * (a) function components silently disappear and (b) helpers returning arrays
 * crash the defs collector.
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

  const elProps = (el.props ?? {}) as Record<string, unknown>;
  if (elProps.children !== undefined) {
    const resolvedChildren = resolveSvgTree(elProps.children as ReactNode);
    if (resolvedChildren !== elProps.children) {
      return { ...el, props: { ...elProps, children: resolvedChildren } };
    }
  }
  return el;
}

/**
 * Check if children contains any React elements (not just strings/numbers).
 */
function hasElementChildren(children: unknown): boolean {
  if (
    children === undefined ||
    children === null ||
    typeof children === "boolean"
  )
    return false;
  if (typeof children === "string" || typeof children === "number")
    return false;

  if (Array.isArray(children)) {
    return children.some(
      (child) =>
        child !== null &&
        child !== undefined &&
        typeof child !== "boolean" &&
        typeof child !== "string" &&
        typeof child !== "number",
    );
  }

  // Single React element
  return typeof children === "object";
}
