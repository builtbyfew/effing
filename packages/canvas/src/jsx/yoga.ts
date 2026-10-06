import Yoga, {
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Unit,
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
  MeasureMode,
  Overflow,
  PositionType,
  Unit,
  Wrap,
};

export function createYogaNode(): YogaNode {
  return Yoga.Node.create();
}

let textConfig: ReturnType<typeof Yoga.Config.create> | undefined;

/**
 * A node for text, whose layout Yoga leaves unrounded (its parents are still
 * rounded to whole pixels). Its width is then the width the text was measured
 * at, which it's drawn at too, so a line that just fits stays on one line,
 * and a line that doesn't wraps, as in a browser.
 */
export function createTextYogaNode(): YogaNode {
  if (!textConfig) {
    textConfig = Yoga.Config.create();
    textConfig.setPointScaleFactor(0);
  }
  return Yoga.Node.create(textConfig);
}

export function freeYogaNode(node: YogaNode): void {
  node.freeRecursive();
}
