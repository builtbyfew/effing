export type SvgChild = {
  type: string;
  props: Record<string, unknown>;
  children?: SvgChild | SvgChild[];
};

export type BBox = { x: number; y: number; width: number; height: number };

export type InheritedSvgStyle = {
  fill: string;
  stroke?: string;
  strokeWidth?: string | number;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  strokeOpacity?: string | number;
};

/** Collected `<defs>` definitions: clip paths, gradients, masks, and filters. */
export type SvgDefs = {
  clips: Map<string, SvgChild[]>;
  gradients: Map<string, SvgChild>;
  masks: Map<string, SvgChild[]>;
  filters: Map<string, SvgChild>;
  /** Viewport (viewBox) size, for resolving `userSpaceOnUse` percentages. */
  viewport: { width: number; height: number };
};
