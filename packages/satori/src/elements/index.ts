import React, { type ReactElement, type ReactNode } from "react";

/**
 * Wrap a root-level array (e.g. from a top-level Fragment) in a
 * layout-transparent div so satori always receives a single element.
 */
export function ensureSingleElement(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return React.createElement(
      "div",
      { style: { display: "contents" } },
      ...node,
    );
  }
  return node;
}

const ELEMENT_MARKER = "__react_element__";

type SerializedElement = {
  [ELEMENT_MARKER]: true;
  type: string;
  key: string | null;
  props: Record<string, unknown>;
};

/**
 * Recursively expand all function components in a React element tree
 * until only intrinsic elements (div, svg, path, img, etc.) remain.
 */
export function expandElement(node: ReactNode): ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) {
    return node.flatMap((child) => {
      const result = expandElement(child);
      return Array.isArray(result) ? result : [result];
    });
  }

  if (!React.isValidElement(node)) return node;

  const element = node as ReactElement;

  if (element.type === React.Fragment) {
    const children = (element.props as Record<string, unknown>)
      .children as ReactNode;
    if (children == null) return null;
    return expandElement(children);
  }

  if (typeof element.type === "function") {
    const result = (element.type as (props: unknown) => ReactNode)(
      element.props,
    );
    return expandElement(result);
  }

  // Intrinsic element — recursively expand children
  const props = Object.assign({}, element.props) as Record<string, unknown>;
  if (props.children != null) {
    props.children = expandElement(props.children as ReactNode);
  }
  return React.createElement(element.type as string, {
    ...props,
    key: element.key,
  });
}

/**
 * Serialize an expanded React element tree to a structured-clone-safe format.
 * All function components must already be expanded to intrinsic elements.
 */
export function serializeElement(node: ReactNode): unknown {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(serializeElement);

  if (!React.isValidElement(node)) return node;

  const element = node as ReactElement;

  if (typeof element.type === "function") {
    throw new Error(
      `Cannot serialize function component "${element.type.name || "anonymous"}". ` +
        "Call expandElement first.",
    );
  }

  if (typeof element.type !== "string") {
    throw new Error(
      `Cannot serialize element with type "${String(element.type)}". Call expandElement first.`,
    );
  }

  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    element.props as Record<string, unknown>,
  )) {
    if (key === "children") {
      props.children = serializeElement(value as ReactNode);
    } else if (value instanceof Buffer) {
      props[key] = { __buffer__: true, data: Array.from(value) };
    } else {
      props[key] = value;
    }
  }

  return {
    [ELEMENT_MARKER]: true,
    type: element.type as string,
    key: element.key,
    props,
  } satisfies SerializedElement;
}

/**
 * Deserialize a serialized element tree back into React elements.
 */
export function deserializeElement(data: unknown): ReactNode {
  if (data == null || typeof data === "boolean") return data as ReactNode;
  if (typeof data === "string" || typeof data === "number") return data;
  if (Array.isArray(data)) return data.map(deserializeElement);

  if (typeof data === "object" && data !== null && ELEMENT_MARKER in data) {
    const serialized = data as SerializedElement;
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(serialized.props)) {
      if (key === "children") {
        props.children = deserializeElement(value);
      } else if (
        typeof value === "object" &&
        value !== null &&
        "__buffer__" in value
      ) {
        props[key] = Buffer.from((value as unknown as { data: number[] }).data);
      } else {
        props[key] = value;
      }
    }
    return React.createElement(serialized.type, {
      ...props,
      key: serialized.key,
    });
  }

  return data as ReactNode;
}
