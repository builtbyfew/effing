import { deserialize, serialize } from "@effing/serde";
import invariant from "tiny-invariant";

const MAX_DIMENSION = 8192;

type UrlSegmentPayload = {
  id: string;
  props: Record<string, unknown>;
  width: number;
  height: number;
};

export function serializeUrlSegment(
  payload: UrlSegmentPayload,
): Promise<string> {
  return serialize(payload, process.env.SECRET_KEY!);
}

export async function deserializeUrlSegment(
  segment: string,
): Promise<UrlSegmentPayload> {
  const { id, props, width, height } = await deserialize<UrlSegmentPayload>(
    segment,
    process.env.SECRET_KEY!,
  );

  invariant(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= MAX_DIMENSION &&
      height <= MAX_DIMENSION,
    `invalid bounds in segment: ${width}x${height}`,
  );

  return { id, props, width, height };
}

export function parseBoundsFromUrl(url: string): {
  width: number;
  height: number;
} {
  const searchParams = new URL(url).searchParams;
  const width = Number(searchParams.get("w") ?? 1080);
  const height = Number(searchParams.get("h") ?? 1080);
  invariant(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= MAX_DIMENSION &&
      height <= MAX_DIMENSION,
    `invalid bounds: ${width}x${height}`,
  );
  return { width, height };
}
