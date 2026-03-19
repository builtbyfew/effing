import type { SKRSContext2D } from "@napi-rs/canvas";

/**
 * Save context state and apply transform + opacity if present.
 * Returns true if ctx.save() was called (caller must ctx.restore()).
 */
export function applyTransformAndOpacity(
  ctx: SKRSContext2D,
  transform: string | undefined,
  opacity: number,
): boolean {
  if (!transform && opacity >= 1) return false;
  ctx.save();
  if (transform) applySvgTransform(ctx, transform);
  if (opacity < 1) ctx.globalAlpha *= opacity;
  return true;
}

/**
 * Parse an SVG `transform` attribute and apply it to the canvas context.
 *
 * Supports: translate, scale, rotate, skewX, skewY, matrix.
 * Multiple transforms are applied left-to-right (same order as SVG spec).
 */
export function applySvgTransform(ctx: SKRSContext2D, transform: string): void {
  const re = /\b(translate|scale|rotate|skewX|skewY|matrix)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(transform)) !== null) {
    const fn = match[1]!;
    const args = match[2]!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    switch (fn) {
      case "translate":
        ctx.translate(args[0] ?? 0, args[1] ?? 0);
        break;
      case "scale": {
        const sx = args[0] ?? 1;
        ctx.scale(sx, args[1] ?? sx);
        break;
      }
      case "rotate": {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        if (args.length >= 3) {
          const cx = args[1]!;
          const cy = args[2]!;
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.translate(-cx, -cy);
        } else {
          ctx.rotate(angle);
        }
        break;
      }
      case "skewX":
        ctx.transform(
          1,
          0,
          Math.tan(((args[0] ?? 0) * Math.PI) / 180),
          1,
          0,
          0,
        );
        break;
      case "skewY":
        ctx.transform(
          1,
          Math.tan(((args[0] ?? 0) * Math.PI) / 180),
          0,
          1,
          0,
          0,
        );
        break;
      case "matrix":
        ctx.transform(
          args[0] ?? 1,
          args[1] ?? 0,
          args[2] ?? 0,
          args[3] ?? 1,
          args[4] ?? 0,
          args[5] ?? 0,
        );
        break;
    }
  }
}
