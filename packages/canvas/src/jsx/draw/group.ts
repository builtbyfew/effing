// Compositing groups through @effing/skia's `beginGroup` / `endGroup`:
// everything drawn inside a group is composited as one when it ends, which is
// what CSS `opacity`, `filter` and `backdrop-filter` mean on an element.
// Per-draw `globalAlpha` and `ctx.filter` can't give that once draws overlap:
// overlapping children would show through each other, and each would cast its
// own shadow.
//
// A group is composited through an offscreen buffer, which @effing/skia sizes
// to what the group draws, so a translucent element costs about as much as
// its own area.

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

/**
 * Start the group an element and its descendants paint into, when its
 * `opacity` or `filter` call for one. Returns whether a group was started,
 * to end with `endElementGroup`.
 */
export function beginElementGroup(
  ctx: SKRSContext2D,
  opacity: number,
  filter: string | undefined,
): boolean {
  const hasFilter = !isNoFilter(filter);
  if (opacity >= 1 && !hasFilter) return false;
  beginGroup(ctx, { opacity, filter: hasFilter ? filter!.trim() : undefined });
  return true;
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
