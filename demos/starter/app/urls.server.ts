import { effieWebUrl } from "@effing/effie";
import { pngFromSatori } from "@effing/satori";
import type { PngFromSatoriOptions } from "@effing/satori";
import { serialize } from "@effing/serde";

export type { FontData, PngFromSatoriOptions } from "@effing/satori";

/**
 * Generate a data URL for a PNG image from a React/JSX template using Satori
 */
export async function pngUrlFromSatori(
  template: Parameters<typeof pngFromSatori>[0],
  options: PngFromSatoriOptions,
) {
  const buffer = await pngFromSatori(template, options);
  return effieWebUrl(`data:image/png;base64,${buffer.toString("base64")}`);
}

/**
 * Generate a signed URL for an annie animation
 */
export async function annieUrl<P extends Record<string, unknown>>({
  annieId,
  props,
  width,
  height,
}: {
  annieId: string;
  props: P;
  width: number;
  height: number;
}) {
  const urlSegment = await serialize(
    { annieId, ...props },
    process.env.SECRET_KEY!,
  );
  return effieWebUrl(
    `${process.env.BASE_URL!}/an/${urlSegment}?w=${width}&h=${height}`,
  );
}
