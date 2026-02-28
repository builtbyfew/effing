import type { ReactNode } from "react";

export type FontData = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight?: number;
  style?: "normal" | "italic";
};

export type SkiatoriOptions = {
  width: number;
  height: number;
  fonts?: FontData[];
};

export type Style = Record<string, string | number | undefined>;

export type LayoutNode = {
  tag: string;
  left: number;
  top: number;
  width: number;
  height: number;
  style: Style;
  text: string | null;
  children: LayoutNode[];
  imgSrc: string | Buffer | null;
};

export type ExpandedNode =
  | {
      tag: string;
      style: Style;
      children: ExpandedNode[];
      imgSrc: string | Buffer | null;
    }
  | { text: string };

/**
 * Recursively expand a React element tree into a simplified element tree
 * with only intrinsic elements (div, span, p, img) and text nodes.
 */
export function expandToTree(node: ReactNode): ExpandedNode[] {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string") return node === "" ? [] : [{ text: node }];
  if (typeof node === "number") return [{ text: String(node) }];

  if (Array.isArray(node)) {
    return node.flatMap(expandToTree);
  }

  if (typeof node !== "object" || !("type" in node)) return [];

  const element = node as {
    type: string | ((...args: unknown[]) => unknown) | symbol;
    props: Record<string, unknown>;
  };

  // Fragment — unwrap children
  if (
    typeof element.type === "symbol" ||
    element.type === (Symbol.for("react.fragment") as unknown)
  ) {
    return expandToTree(element.props.children as ReactNode);
  }

  // Function component — call it to expand
  if (typeof element.type === "function") {
    const result = (element.type as (props: unknown) => ReactNode)(
      element.props,
    );
    return expandToTree(result);
  }

  // Intrinsic element
  const tag = element.type as string;
  const style = (element.props.style ?? {}) as Style;
  const children = expandToTree(element.props.children as ReactNode);
  const imgSrc =
    tag === "img"
      ? ((element.props.src as string | Buffer | null) ?? null)
      : null;

  return [{ tag, style, children, imgSrc }];
}
