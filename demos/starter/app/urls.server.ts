import type { ReactNode } from "react";
import { effieWebUrl } from "@effing/effie";
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { FontData } from "@effing/canvas";
import { serialize } from "@effing/serde";

export type { FontData } from "@effing/canvas";

/**
 * Generate a data URL for a PNG image from a React/JSX element
 */
export async function pngUrlFromReactElement(
  element: ReactNode,
  {
    width,
    height,
    fonts,
  }: { width: number; height: number; fonts: FontData[] },
) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await renderReactElement(ctx, element, { fonts });
  const buffer = await canvas.encode("png");
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
