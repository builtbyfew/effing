import sharp from "sharp";
import { z } from "zod";
import { tween, easeOutQuad } from "@effing/tween";
import type { AnnieRendererArgs } from ".";

export const propsSchema = z.object({
  imageUrl: z.string().url(),
  frameCount: z.number().int().min(1).optional(),
  zoomLevel: z.number().optional(),
});

export type PhotoZoomProps = z.infer<typeof propsSchema>;

export const previewProps: PhotoZoomProps = {
  imageUrl: "https://picsum.photos/1200/1200",
  frameCount: 120,
  zoomLevel: 0.2,
};

export async function* renderer({
  props: { imageUrl, frameCount = 90, zoomLevel = 0.2 },
  width,
  height,
}: AnnieRendererArgs<PhotoZoomProps>): AsyncGenerator<Buffer> {
  // Fetch and decode the source image
  const image = await fetch(imageUrl);
  const imageBuffer = await image.arrayBuffer();
  const { data: originalImageData, info: originalImageInfo } = await sharp(
    Buffer.from(imageBuffer),
  )
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imageSharp = sharp(originalImageData, {
    raw: {
      width: originalImageInfo.width,
      height: originalImageInfo.height,
      channels: originalImageInfo.channels,
    },
  });

  // Generate frames with zoom effect
  yield* tween(frameCount, async ({ lower: p }) => {
    const zoomValue = 1 + zoomLevel * easeOutQuad(p);
    const ow = Math.round(width * zoomValue);
    const oh = Math.round(height * zoomValue);
    const left = Math.floor((ow - width) / 2);
    const top = Math.floor((oh - height) / 2);
    return imageSharp
      .clone()
      .resize(ow, oh, { fit: "cover" })
      .extract({ left, top, width, height })
      .jpeg()
      .toBuffer();
  });
}
