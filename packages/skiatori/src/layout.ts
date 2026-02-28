import Yoga, { MeasureMode } from "yoga-layout";
import type { Node as YogaNode, MeasureFunction } from "yoga-layout";
import type { Image } from "skia-canvas";

import type { ExpandedNode, LayoutNode, Style } from "./types.ts";
import { applyStylesToYogaNode } from "./styles.ts";
import type { MeasureTextFn } from "./styles.ts";
import { loadImageFromSrc } from "./image.ts";

// ---------------------------------------------------------------------------
// Collect text from children of a node
// ---------------------------------------------------------------------------

function collectText(nodes: ExpandedNode[]): string {
  return nodes
    .map((n) => ("text" in n ? n.text : ""))
    .filter(Boolean)
    .join("");
}

function hasOnlyTextChildren(nodes: ExpandedNode[]): boolean {
  return nodes.length > 0 && nodes.every((n) => "text" in n);
}

// ---------------------------------------------------------------------------
// Resolve the effective style for a text node by inheriting from its parent
// ---------------------------------------------------------------------------

const INHERITABLE_PROPS = [
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "wordSpacing",
  "lineHeight",
  "textAlign",
  "whiteSpace",
] as const;

function inheritTextStyle(parentStyle: Style): Style {
  const result: Style = {};
  for (const prop of INHERITABLE_PROPS) {
    if (parentStyle[prop] != null) {
      result[prop] = parentStyle[prop];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Image collection + preloading
// ---------------------------------------------------------------------------

export type ImageMap = Map<string | Buffer, Image>;

function collectImageSources(nodes: ExpandedNode[]): (string | Buffer)[] {
  const sources: (string | Buffer)[] = [];
  function walk(ns: ExpandedNode[]) {
    for (const n of ns) {
      if ("text" in n) continue;
      if (n.imgSrc) sources.push(n.imgSrc);
      walk(n.children);
    }
  }
  walk(nodes);
  return sources;
}

async function preloadImages(
  sources: (string | Buffer)[],
): Promise<ImageMap> {
  const images: ImageMap = new Map();
  const loaded = await Promise.all(sources.map(loadImageFromSrc));
  for (let i = 0; i < sources.length; i++) {
    images.set(sources[i], loaded[i]);
  }
  return images;
}

// ---------------------------------------------------------------------------
// Build yoga tree from expanded nodes
// ---------------------------------------------------------------------------

type YogaBuildResult = {
  yogaNode: YogaNode;
  layoutMeta: LayoutMeta;
};

type LayoutMeta = {
  tag: string;
  style: Style;
  text: string | null;
  imgSrc: string | Buffer | null;
  children: LayoutMeta[];
};

function buildYogaTree(
  node: ExpandedNode,
  measureTextFn: MeasureTextFn,
  images: ImageMap,
  parentStyle: Style,
): YogaBuildResult {
  // Text leaf
  if ("text" in node) {
    const textStyle = inheritTextStyle(parentStyle);
    const yogaNode = Yoga.Node.create();
    const text = node.text;

    const measure: MeasureFunction = (
      width,
      widthMode,
      _height,
      _heightMode,
    ) => {
      const maxWidth = widthMode === MeasureMode.Undefined ? undefined : width;
      return measureTextFn(text, textStyle, maxWidth);
    };
    yogaNode.setMeasureFunc(measure);

    return {
      yogaNode,
      layoutMeta: {
        tag: "#text",
        style: textStyle,
        text,
        imgSrc: null,
        children: [],
      },
    };
  }

  const yogaNode = Yoga.Node.create();
  const style = node.style;
  applyStylesToYogaNode(yogaNode, style);

  // Image element — set intrinsic size
  if (node.imgSrc) {
    const img = images.get(node.imgSrc);
    if (img) {
      if (style.width == null) yogaNode.setWidth(img.width);
      if (style.height == null) yogaNode.setHeight(img.height);
    }
  }

  // If all children are text, treat this as a text-container node
  if (hasOnlyTextChildren(node.children)) {
    const text = collectText(node.children);
    if (text) {
      const textStyle = { ...inheritTextStyle(style), ...style };
      const measure: MeasureFunction = (
        width,
        widthMode,
        _height,
        _heightMode,
      ) => {
        const maxWidth =
          widthMode === MeasureMode.Undefined ? undefined : width;
        return measureTextFn(text, textStyle, maxWidth);
      };
      yogaNode.setMeasureFunc(measure);

      return {
        yogaNode,
        layoutMeta: {
          tag: node.tag,
          style,
          text,
          imgSrc: node.imgSrc,
          children: [],
        },
      };
    }
  }

  // Recurse into children
  const childMetas: LayoutMeta[] = [];
  let childIndex = 0;
  for (const child of node.children) {
    const result = buildYogaTree(child, measureTextFn, images, style);
    yogaNode.insertChild(result.yogaNode, childIndex++);
    childMetas.push(result.layoutMeta);
  }

  return {
    yogaNode,
    layoutMeta: {
      tag: node.tag,
      style,
      text: null,
      imgSrc: node.imgSrc,
      children: childMetas,
    },
  };
}

// ---------------------------------------------------------------------------
// Extract computed layout
// ---------------------------------------------------------------------------

function extractLayout(yogaNode: YogaNode, meta: LayoutMeta): LayoutNode {
  const layout = yogaNode.getComputedLayout();

  const children: LayoutNode[] = [];
  for (let i = 0; i < meta.children.length; i++) {
    const childYoga = yogaNode.getChild(i);
    children.push(extractLayout(childYoga, meta.children[i]));
  }

  return {
    tag: meta.tag,
    left: layout.left,
    top: layout.top,
    width: layout.width,
    height: layout.height,
    style: meta.style,
    text: meta.text,
    imgSrc: meta.imgSrc,
    children,
  };
}

// ---------------------------------------------------------------------------
// Core layout computation (sync when no images)
// ---------------------------------------------------------------------------

function runLayout(
  nodes: ExpandedNode[],
  width: number,
  height: number,
  measureTextFn: MeasureTextFn,
  images: ImageMap,
): LayoutNode {
  const rootExpanded: ExpandedNode = {
    tag: "div",
    style: { width, height, display: "flex", flexDirection: "column" },
    children: nodes,
    imgSrc: null,
  };

  const { yogaNode: rootYoga, layoutMeta } = buildYogaTree(
    rootExpanded,
    measureTextFn,
    images,
    {},
  );

  rootYoga.calculateLayout(width, height);
  const layoutTree = extractLayout(rootYoga, layoutMeta);
  rootYoga.freeRecursive();

  return layoutTree;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const emptyImageMap: ImageMap = new Map();

export type ComputeLayoutResult = {
  layout: LayoutNode;
  images: ImageMap;
};

/**
 * Compute layout for an element tree. Returns the layout tree and any
 * preloaded images (passed through to the renderer).
 *
 * Synchronous when there are no `<img>` elements in the tree.
 */
export function computeLayout(
  nodes: ExpandedNode[],
  width: number,
  height: number,
  measureTextFn: MeasureTextFn,
): ComputeLayoutResult | Promise<ComputeLayoutResult> {
  const sources = collectImageSources(nodes);

  // Fast path: no images → fully synchronous
  if (sources.length === 0) {
    return {
      layout: runLayout(nodes, width, height, measureTextFn, emptyImageMap),
      images: emptyImageMap,
    };
  }

  // Slow path: preload images, then compute layout
  return preloadImages(sources).then((images) => ({
    layout: runLayout(nodes, width, height, measureTextFn, images),
    images,
  }));
}
