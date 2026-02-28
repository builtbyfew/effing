import { loadYoga, MeasureMode } from "yoga-layout/load";
import type { Node as YogaNode, Yoga, MeasureFunction } from "yoga-layout/load";
import type { Image } from "skia-canvas";

import type { ExpandedNode, LayoutNode, Style } from "./types.ts";
import { applyStylesToYogaNode } from "./styles.ts";
import type { MeasureTextFn } from "./styles.ts";
import { loadImageFromSrc } from "./image.ts";

let yogaInstance: Yoga | null = null;

async function getYoga(): Promise<Yoga> {
  if (!yogaInstance) {
    yogaInstance = await loadYoga();
  }
  return yogaInstance;
}

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
// Pre-load all images from the tree
// ---------------------------------------------------------------------------

type ImageMap = Map<string | Buffer, Image>;

async function preloadImages(nodes: ExpandedNode[]): Promise<ImageMap> {
  const images: ImageMap = new Map();
  const sources: (string | Buffer)[] = [];

  function walk(ns: ExpandedNode[]) {
    for (const n of ns) {
      if ("text" in n) continue;
      if (n.imgSrc) sources.push(n.imgSrc);
      walk(n.children);
    }
  }

  walk(nodes);

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
  yoga: Yoga,
  node: ExpandedNode,
  measureTextFn: MeasureTextFn,
  images: ImageMap,
  parentStyle: Style,
): YogaBuildResult {
  // Text leaf — should not happen at top level, handled by parent
  if ("text" in node) {
    const textStyle = inheritTextStyle(parentStyle);
    const yogaNode = yoga.Node.create();
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

  const yogaNode = yoga.Node.create();
  const style = node.style;
  applyStylesToYogaNode(yogaNode, style);

  // Image element — set intrinsic size
  if (node.imgSrc) {
    const img = images.get(node.imgSrc);
    if (img) {
      // If no explicit width/height, use image's intrinsic size
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
    const result = buildYogaTree(yoga, child, measureTextFn, images, style);
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
// Public API
// ---------------------------------------------------------------------------

export async function computeLayout(
  nodes: ExpandedNode[],
  width: number,
  height: number,
  measureTextFn: MeasureTextFn,
): Promise<LayoutNode> {
  const yoga = await getYoga();
  const images = await preloadImages(nodes);

  // Wrap in a root container
  const rootExpanded: ExpandedNode = {
    tag: "div",
    style: { width, height, display: "flex", flexDirection: "column" },
    children: nodes,
    imgSrc: null,
  };

  const { yogaNode: rootYoga, layoutMeta } = buildYogaTree(
    yoga,
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

export { type ImageMap, preloadImages };
