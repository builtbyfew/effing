import type { SKRSContext2D } from "@napi-rs/canvas";

/**
 * Parse and create a canvas gradient from a CSS gradient string.
 * Supports linear-gradient and radial-gradient.
 *
 * @returns A CanvasGradient or null if parsing fails
 */
export function createGradientFromCSS(
  ctx: SKRSContext2D,
  cssGradient: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasGradient | null {
  const trimmed = cssGradient.trim();

  if (trimmed.startsWith("linear-gradient")) {
    return parseLinearGradient(ctx, trimmed, x, y, width, height);
  }

  if (trimmed.startsWith("radial-gradient")) {
    return parseRadialGradient(ctx, trimmed, x, y, width, height);
  }

  return null;
}

function parseLinearGradient(
  ctx: SKRSContext2D,
  css: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasGradient | null {
  // Extract content between parentheses
  const match = css.match(/linear-gradient\((.*)\)/s);
  if (!match) return null;

  const content = match[1]!.trim();
  const parts = splitGradientArgs(content);

  let angle = 180; // default: to bottom
  let colorStartIdx = 0;

  // Parse direction
  const first = parts[0]?.trim();
  if (first) {
    if (first.startsWith("to ")) {
      angle = directionToAngle(first);
      colorStartIdx = 1;
    } else if (first.endsWith("deg")) {
      angle = parseFloat(first);
      colorStartIdx = 1;
    } else if (first.endsWith("turn")) {
      angle = parseFloat(first) * 360;
      colorStartIdx = 1;
    }
  }

  // Calculate gradient line endpoints
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const halfDiag =
    Math.abs(width * Math.cos(rad)) / 2 + Math.abs(height * Math.sin(rad)) / 2;

  const x0 = cx - halfDiag * Math.cos(rad);
  const y0 = cy - halfDiag * Math.sin(rad);
  const x1 = cx + halfDiag * Math.cos(rad);
  const y1 = cy + halfDiag * Math.sin(rad);

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

  // Parse color stops
  const stops = parts.slice(colorStartIdx);
  addColorStops(gradient, stops);

  return gradient;
}

function parseRadialGradient(
  ctx: SKRSContext2D,
  css: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasGradient | null {
  const match = css.match(/radial-gradient\((.*)\)/s);
  if (!match) return null;

  const content = match[1]!.trim();
  const parts = splitGradientArgs(content);

  const cx = x + width / 2;
  const cy = y + height / 2;
  const radius = Math.max(width, height) / 2;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

  // Simple parsing: skip shape/size/position, just get color stops
  let colorStartIdx = 0;
  const first = parts[0]?.trim() ?? "";
  if (
    first.startsWith("circle") ||
    first.startsWith("ellipse") ||
    first.startsWith("closest") ||
    first.startsWith("farthest")
  ) {
    colorStartIdx = 1;
  }

  addColorStops(gradient, parts.slice(colorStartIdx));

  return gradient;
}

function addColorStops(gradient: CanvasGradient, stops: string[]): void {
  if (stops.length === 0) return;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]!.trim();
    const percentMatch = stop.match(/^(.+?)\s+(\d+(?:\.\d+)?%?)$/);

    if (percentMatch) {
      const color = percentMatch[1]!;
      const pos = percentMatch[2]!;
      const offset = pos.endsWith("%")
        ? parseFloat(pos) / 100
        : parseFloat(pos);
      gradient.addColorStop(Math.max(0, Math.min(1, offset)), color);
    } else {
      // Auto-distribute
      const offset = stops.length === 1 ? 0.5 : i / (stops.length - 1);
      gradient.addColorStop(offset, stop);
    }
  }
}

function directionToAngle(dir: string): number {
  const map: Record<string, number> = {
    "to top": 0,
    "to right": 90,
    "to bottom": 180,
    "to left": 270,
    "to top right": 45,
    "to top left": 315,
    "to bottom right": 135,
    "to bottom left": 225,
  };
  return map[dir] ?? 180;
}

function splitGradientArgs(content: string): string[] {
  const parts: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of content) {
    if (char === "(") parenDepth++;
    if (char === ")") parenDepth--;
    if (char === "," && parenDepth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);

  return parts;
}
