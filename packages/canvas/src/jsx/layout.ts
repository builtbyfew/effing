// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { SKRSContext2D } from "@napi-rs/canvas";
import { loadImage } from "@napi-rs/canvas";
import type { ReactElement, ReactNode } from "react";

import { expandStyle } from "./style/expand.ts";
import { resolveStyle, resolveUnits, DEFAULT_STYLE } from "./style/compute.ts";
import type { ComputedStyle } from "./style/compute.ts";
import { applyStylesToYoga } from "./style/properties.ts";
import { createTextMeasureFunc } from "./text/index.ts";
import { createYogaNode, freeYogaNode } from "./yoga.ts";
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
): Promise<LayoutNode> {
  const rootYogaNode = createYogaNode();

  // Build the tree
  const rootNode = await buildNode(
    element,
    DEFAULT_STYLE,
    rootYogaNode,
    containerWidth,
    containerHeight,
    ctx,
    emojiEnabled,
  );

  // Set root dimensions
  rootYogaNode.setWidth(containerWidth);
  rootYogaNode.setHeight(containerHeight);

  // Calculate layout
  rootYogaNode.calculateLayout(containerWidth, containerHeight);

  // Extract computed positions
  const layoutTree = extractLayout(rootNode, rootYogaNode);

  // Free Yoga nodes
  freeYogaNode(rootYogaNode);

  return layoutTree;
}

async function buildNode(
  element: ReactNode,
  parentStyle: ComputedStyle,
  yogaNode: YogaNode,
  viewportWidth: number,
  viewportHeight: number,
  ctx?: SKRSContext2D,
  emojiEnabled?: boolean,
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

  // Handle arrays (fragments)
  if (Array.isArray(element)) {
    const style = resolveStyle(undefined, parentStyle);
    const children: IntermediateNode[] = [];

    for (let i = 0; i < element.length; i++) {
      const child = element[i] as ElementChild;
      if (child === null || child === undefined || typeof child === "boolean")
        continue;

      const childYogaNode = createYogaNode();
      yogaNode.insertChild(childYogaNode, children.length);
      children.push(
        await buildNode(
          child,
          style,
          childYogaNode,
          viewportWidth,
          viewportHeight,
          ctx,
          emojiEnabled,
        ),
      );
    }

    return {
      type: "div",
      style,
      children,
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
    );
  }

  const props = (el.props ?? {}) as Record<string, unknown>;
  const rawStyle = (props.style ?? {}) as Record<string, unknown>;
  const expanded = expandStyle(rawStyle);
  const style = resolveStyle(expanded, parentStyle);
  resolveUnits(style, viewportWidth, viewportHeight);

  const tagName = String(type);

  // For <svg> elements, merge width/height props into style when not set via CSS
  if (tagName === "svg") {
    if (props.width != null && style.width === undefined) {
      const v = props.width;
      style.width = typeof v === "string" && v.endsWith("%") ? v : Number(v);
    }
    if (props.height != null && style.height === undefined) {
      const v = props.height;
      style.height = typeof v === "string" && v.endsWith("%") ? v : Number(v);
    }

    // Derive missing dimension from viewBox aspect ratio
    const viewBox = props.viewBox as string | undefined;
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        const [, , vbW, vbH] = parts as [number, number, number, number];
        if (vbW > 0 && vbH > 0) {
          const w = typeof style.width === "number" ? style.width : undefined;
          const h = typeof style.height === "number" ? style.height : undefined;
          if (w !== undefined && h === undefined) {
            style.height = w * (vbH / vbW);
          } else if (h !== undefined && w === undefined) {
            style.width = h * (vbW / vbH);
          } else if (w === undefined && h === undefined) {
            style.width = vbW;
            style.height = vbH;
          }
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
        const image = await loadImage(src);
        const naturalW = image.width;
        const naturalH = image.height;

        const w = typeof style.width === "number" ? style.width : undefined;
        const h = typeof style.height === "number" ? style.height : undefined;

        if (w !== undefined && h === undefined && naturalW > 0) {
          style.height = w * (naturalH / naturalW);
        } else if (h !== undefined && w === undefined && naturalH > 0) {
          style.width = h * (naturalW / naturalH);
        }

        // Cache loaded image for reuse during drawing
        props.__loadedImage = image;
      } catch {
        // Silent fail — image will render at whatever size Yoga computes
      }
    }
  }

  // Apply styles to Yoga node
  applyStylesToYoga(yogaNode, style);

  // SVG containers: children use SVG coordinate space, not flex layout.
  // Skip Yoga child nodes and keep React children in props for the SVG drawer.
  if (tagName === "svg") {
    return {
      type: tagName,
      style,
      children: [],
      props,
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
    childYogaNode.setFlexGrow(1);
    childYogaNode.setFlexShrink(1);
    yogaNode.insertChild(childYogaNode, 0);

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
    const childArray = Array.isArray(rawChildren) ? rawChildren : [rawChildren];

    for (const child of childArray as ElementChild[]) {
      if (child === null || child === undefined || typeof child === "boolean")
        continue;

      const childYogaNode = createYogaNode();
      yogaNode.insertChild(childYogaNode, children.length);
      children.push(
        await buildNode(
          child,
          style,
          childYogaNode,
          viewportWidth,
          viewportHeight,
          ctx,
          emojiEnabled,
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
