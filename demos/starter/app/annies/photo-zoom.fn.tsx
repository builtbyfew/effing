import { z } from "zod";
import { tween, easeOutQuad } from "@effing/tween";
import { createCanvas, loadImage } from "@effing/canvas";
import type { RunnerArgs, AnnieRunnerReturn } from "@effing/fn";

export const propsSchema = z.object({
  imageUrl: z.string().url(),
  frameCount: z.number().int().min(1).optional(),
  zoomLevel: z.number().optional(),
});

export type PhotoZoomProps = z.infer<typeof propsSchema>;

export const previewProps: PhotoZoomProps = {
  imageUrl: "https://static.effing.dev/picsum/1080/1080/coffee.jpg",
  frameCount: 120,
  zoomLevel: 0.2,
};

export async function* runner({
  props: { imageUrl, frameCount = 90, zoomLevel = 0.2 },
  bounds: { width, height },
}: RunnerArgs<PhotoZoomProps>): AnnieRunnerReturn {
  // Fetch and decode the source image
  const response = await fetch(imageUrl);
  const imageBuffer = await response.arrayBuffer();
  const image = await loadImage(Buffer.from(imageBuffer));

  // Cover-crop the source to the target aspect ratio before zooming
  const targetAspect = width / height;
  const imageAspect = image.width / image.height;
  const baseW =
    imageAspect > targetAspect ? image.height * targetAspect : image.width;
  const baseH =
    imageAspect > targetAspect ? image.height : image.width / targetAspect;

  // Generate frames with zoom effect
  yield* tween(frameCount, async ({ lower: p }) => {
    const zoomValue = 1 + zoomLevel * easeOutQuad(p);

    // Source rectangle shrinks toward center as zoom increases
    const sw = baseW / zoomValue;
    const sh = baseH / zoomValue;
    const sx = (image.width - sw) / 2;
    const sy = (image.height - sh) / 2;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

    return canvas.encode("jpeg");
  });
}
