import { deserialize, serialize } from "@effing/serde";
import type { Bounds } from "../types";

export const MAX_DIMENSION = 8192;

export type FnSegmentPayload = {
  id: string;
  props?: Record<string, unknown>;
  bounds: Bounds;
};

export function validateBounds(raw: unknown): Bounds {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('Segment missing "bounds"');
  }
  const { width, height } = raw as { width?: unknown; height?: unknown };
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Bounds must be integers");
  }
  const w = width as number;
  const h = height as number;
  if (w <= 0 || h <= 0 || w > MAX_DIMENSION || h > MAX_DIMENSION) {
    throw new Error(`Bounds out of range (1..${MAX_DIMENSION}): ${w}x${h}`);
  }
  return { width: w, height: h };
}

export function signFnSegment(
  payload: FnSegmentPayload,
  secretKey: string,
): Promise<string> {
  return serialize(payload, secretKey);
}

export type VerifyFnSegmentOptions = {
  /** When true (default), the segment must include a props object. */
  requireProps?: boolean;
};

export async function verifyFnSegment(
  segment: string,
  secretKey: string,
  options: VerifyFnSegmentOptions = {},
): Promise<FnSegmentPayload> {
  const { requireProps = true } = options;

  let payload: { id?: unknown; props?: unknown; bounds?: unknown };
  try {
    payload = await deserialize<{
      id?: unknown;
      props?: unknown;
      bounds?: unknown;
    }>(segment, secretKey);
  } catch {
    throw new Error("Invalid segment signature");
  }

  if (typeof payload.id !== "string" || payload.id === "") {
    throw new Error('Segment missing "id"');
  }

  let props: Record<string, unknown> | undefined;
  if (requireProps) {
    if (
      payload.props === null ||
      typeof payload.props !== "object" ||
      Array.isArray(payload.props)
    ) {
      throw new Error('Segment missing "props"');
    }
    props = payload.props as Record<string, unknown>;
  } else if (
    payload.props !== undefined &&
    payload.props !== null &&
    typeof payload.props === "object" &&
    !Array.isArray(payload.props)
  ) {
    props = payload.props as Record<string, unknown>;
  }

  const bounds = validateBounds(payload.bounds);
  return { id: payload.id, props, bounds };
}
