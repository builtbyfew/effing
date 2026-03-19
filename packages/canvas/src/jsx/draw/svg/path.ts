import { Path2D } from "@napi-rs/canvas";

import type { BBox, SvgChild } from "./types.ts";
import { mergeStyleIntoProps } from "./style.ts";
import { svgLength } from "./style.ts";

/** Compute a conservative bounding box from SVG path data. */
export function pathBBox(d: string): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;

  const update = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // Tokenize: commands and numbers (including negative)
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return { x: 0, y: 0, width: 0, height: 0 };

  let cmd = "";
  let i = 0;
  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    }

    switch (cmd) {
      case "M":
        cx = num();
        cy = num();
        update(cx, cy);
        cmd = "L"; // implicit lineTo after moveTo
        break;
      case "m":
        cx += num();
        cy += num();
        update(cx, cy);
        cmd = "l";
        break;
      case "L":
        cx = num();
        cy = num();
        update(cx, cy);
        break;
      case "l":
        cx += num();
        cy += num();
        update(cx, cy);
        break;
      case "H":
        cx = num();
        update(cx, cy);
        break;
      case "h":
        cx += num();
        update(cx, cy);
        break;
      case "V":
        cy = num();
        update(cx, cy);
        break;
      case "v":
        cy += num();
        update(cx, cy);
        break;
      case "C": {
        // Cubic bezier: use control points as conservative bounds
        for (let j = 0; j < 3; j++) {
          const px = num();
          const py = num();
          update(px, py);
        }
        cx = Number(tokens[i - 2]);
        cy = Number(tokens[i - 1]);
        break;
      }
      case "c": {
        for (let j = 0; j < 3; j++) {
          const dx = num();
          const dy = num();
          update(cx + dx, cy + dy);
          if (j === 2) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }
      case "Q": {
        for (let j = 0; j < 2; j++) {
          const px = num();
          const py = num();
          update(px, py);
        }
        cx = Number(tokens[i - 2]);
        cy = Number(tokens[i - 1]);
        break;
      }
      case "q": {
        for (let j = 0; j < 2; j++) {
          const dx = num();
          const dy = num();
          update(cx + dx, cy + dy);
          if (j === 1) {
            cx += dx;
            cy += dy;
          }
        }
        break;
      }
      case "A": {
        // Arc: skip rx, ry, rotation, flags; endpoint is the bound
        num();
        num();
        num();
        num();
        num(); // rx ry rot largeArc sweep
        cx = num();
        cy = num();
        update(cx, cy);
        break;
      }
      case "a": {
        num();
        num();
        num();
        num();
        num();
        cx += num();
        cy += num();
        update(cx, cy);
        break;
      }
      case "Z":
      case "z":
        break;
      default:
        // Unknown command — skip token to avoid infinite loop
        i++;
        break;
    }
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Compute bounding box from a points attribute (polygon/polyline). */
export function pointsBBox(points: [number, number][]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Build a `Path2D` from an SVG shape element (without drawing it).
 * Returns `undefined` for unsupported element types.
 */
export function buildPath(
  child: SvgChild,
  vbW: number,
  vbH: number,
): Path2D | undefined {
  const props = mergeStyleIntoProps(child.props);
  switch (child.type) {
    case "path": {
      const d = props.d as string | undefined;
      if (!d) return undefined;
      return new Path2D(d);
    }
    case "circle": {
      const cx = svgLength(props.cx, vbW);
      const cy = svgLength(props.cy, vbH);
      const r = svgLength(props.r, Math.min(vbW, vbH));
      if (r <= 0) return undefined;
      const p = new Path2D();
      p.arc(cx, cy, r, 0, Math.PI * 2);
      return p;
    }
    case "rect": {
      const x = svgLength(props.x, vbW);
      const y = svgLength(props.y, vbH);
      const w = svgLength(props.width, vbW);
      const h = svgLength(props.height, vbH);
      if (w <= 0 || h <= 0) return undefined;
      const rxRaw = svgLength(props.rx, vbW, -1);
      const ryRaw = svgLength(props.ry, vbH, -1);
      let rx = rxRaw >= 0 ? rxRaw : ryRaw >= 0 ? ryRaw : 0;
      let ry = ryRaw >= 0 ? ryRaw : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      const p = new Path2D();
      if (rx > 0 || ry > 0) {
        p.roundRect(x, y, w, h, [rx]);
      } else {
        p.rect(x, y, w, h);
      }
      return p;
    }
    case "ellipse": {
      const cx = svgLength(props.cx, vbW);
      const cy = svgLength(props.cy, vbH);
      const rx = svgLength(props.rx, vbW);
      const ry = svgLength(props.ry, vbH);
      if (rx <= 0 || ry <= 0) return undefined;
      const p = new Path2D();
      p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      return p;
    }
    case "polygon": {
      const points = parsePoints(props.points as string | undefined);
      if (points.length < 2) return undefined;
      const p = new Path2D();
      p.moveTo(points[0]![0], points[0]![1]);
      for (let i = 1; i < points.length; i++) {
        p.lineTo(points[i]![0], points[i]![1]);
      }
      p.closePath();
      return p;
    }
    default:
      return undefined;
  }
}

/**
 * Build a combined `Path2D` from all children of a `<clipPath>` definition.
 */
export function buildClipPath(
  shapes: SvgChild[],
  vbW: number,
  vbH: number,
): Path2D | undefined {
  let combined: Path2D | undefined;
  for (const shape of shapes) {
    const p = buildPath(shape, vbW, vbH);
    if (!p) continue;
    if (!combined) {
      combined = p;
    } else {
      combined.addPath(p);
    }
  }
  return combined;
}

export function parsePoints(value: string | undefined): [number, number][] {
  if (!value) return [];
  const nums = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const result: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    result.push([nums[i]!, nums[i + 1]!]);
  }
  return result;
}
