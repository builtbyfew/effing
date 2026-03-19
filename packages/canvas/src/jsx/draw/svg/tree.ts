import type { SvgChild } from "./types.ts";

/** Normalize children from either `.children` or `.props.children` into an array. */
export function normalizeChildren(node: SvgChild): SvgChild[] {
  const raw =
    node.children ?? (node.props.children as SvgChild | SvgChild[] | undefined);
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}
