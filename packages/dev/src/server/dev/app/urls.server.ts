import {
  MAX_DIMENSION,
  signFnSegment,
  verifyFnSegment,
  validateBounds,
  type FnSegmentPayload,
} from "@effing/fn/server";
import invariant from "tiny-invariant";
import { getResolutions } from "./resolutions.server";

export function signSegment(payload: FnSegmentPayload): Promise<string> {
  return signFnSegment(payload, requireSecret());
}

export function verifySegment(segment: string): Promise<FnSegmentPayload> {
  return verifyFnSegment(segment, requireSecret());
}

export function parseBoundsFromUrl(url: string): {
  width: number;
  height: number;
} {
  const searchParams = new URL(url).searchParams;
  const fallback = getResolutions()[0];
  const width = Number(searchParams.get("w") ?? fallback.width);
  const height = Number(searchParams.get("h") ?? fallback.height);
  return validateBounds({ width, height });
}

function requireSecret(): string {
  const k = process.env.SECRET_KEY;
  invariant(k, "SECRET_KEY env var is required");
  return k;
}

export { MAX_DIMENSION };
