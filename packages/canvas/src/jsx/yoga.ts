import Yoga, {
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Overflow,
  PositionType,
  Wrap,
} from "yoga-layout";
import type { Node as YogaNode } from "yoga-layout";

export type { YogaNode };

export {
  Yoga,
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Overflow,
  PositionType,
  Wrap,
};

export function createYogaNode(): YogaNode {
  return Yoga.Node.create();
}

export function freeYogaNode(node: YogaNode): void {
  node.freeRecursive();
}
