// Compositing groups through @effing/skia's `beginGroup` / `endGroup`:
// everything drawn inside a group is composited as one when it ends, which is
// what CSS `opacity`, `filter` and `backdrop-filter` mean on an element.
// Per-draw `globalAlpha` and `ctx.filter` can't give that once draws overlap:
// overlapping children would show through each other, and each would cast its
// own shadow.

import type { SKRSContext2D } from "@effing/skia";
import { beginGroup, endGroup } from "@effing/skia/extensions";

import { applyClip } from "./clip.ts";
import type { getBorderRadiusFromStyle } from "./rect.ts";

type BorderRadius = ReturnType<typeof getBorderRadiusFromStyle>;

/** A CSS filter value that filters nothing. */
function isNoFilter(filter: string | undefined): boolean {
  if (!filter) return true;
  const normalized = filter.trim();
  return normalized === "" || normalized === "none";
}

/** A rectangle `[x, y, width, height]` in the current coordinate space. */
export type Bounds = [number, number, number, number];

/**
 * Start the group an element and its descendants paint into, when its
 * `opacity` or `filter` call for one. Returns whether a group was started,
 * to end with `endElementGroup`.
 *
 * A group is composited through a buffer, which covers the whole canvas
 * unless the group is given `bounds`. They also clip it, so they are only
 * passed when everything the group paints is known to fall inside them (see
 * `clippedElementBounds`).
 */
export function beginElementGroup(
  ctx: SKRSContext2D,
  opacity: number,
  filter: string | undefined,
  bounds?: Bounds,
): boolean {
  const hasFilter = !isNoFilter(filter);
  if (opacity >= 1 && !hasFilter) return false;
  if (hasFilter) {
    // A filter can paint past the content it filters; leave its group whole.
    beginGroup(ctx, { opacity, filter: filter!.trim() });
  } else {
    beginGroup(ctx, { opacity, bounds });
  }
  return true;
}

/**
 * What an element that clips its content (`overflow: hidden`) can paint: its
 * border box, plus its box-shadow, which is drawn outside the clip. Grown by a
 * device pixel so the anti-aliased edge of the clip stays inside.
 *
 * Returns undefined when the context's transform is degenerate.
 */
export function clippedElementBounds(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  shadowExtent: number,
): Bounds | undefined {
  const m = ctx.getTransform();
  const scale = Math.min(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  if (!(scale > 0)) return undefined;
  const margin = shadowExtent + 1 / scale;
  return [x - margin, y - margin, width + 2 * margin, height + 2 * margin];
}

export function endElementGroup(ctx: SKRSContext2D): void {
  endGroup(ctx);
}

/**
 * CSS `backdrop-filter`: filter whatever is already painted behind the
 * element's border box (with its radius) and composite the result back at the
 * element's opacity. Must run before the element's own painting — box-shadow
 * and background included — so nothing of the element ends up in its own
 * backdrop and its background composites on top of the filtered result.
 *
 * The filter runs in the element's own coordinate space, and the backdrop is
 * clamped at the canvas edge, as a browser does at the viewport edge, so a
 * blur near the edge doesn't fade into transparency. Skia reads the backdrop
 * from the enclosing group, so as in a browser, an ancestor with `opacity` or
 * a `filter` bounds what the element sees through: only what that ancestor
 * has painted so far.
 */
export function drawBackdropFilter(
  ctx: SKRSContext2D,
  filter: string,
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: BorderRadius,
  opacity: number,
): void {
  if (width <= 0 || height <= 0) return;
  if (isNoFilter(filter)) return;
  ctx.save();
  applyClip(ctx, x, y, width, height, borderRadius);
  beginGroup(ctx, { backdropFilter: filter.trim(), opacity });
  endGroup(ctx);
  ctx.restore();
}
