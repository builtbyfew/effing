import { z } from "zod";
import type { RunnerArgs, ImageRunnerReturn } from "@effing/fn";
import { createCanvas, renderReactElement } from "@effing/canvas";
import { loadFonts, interSemiBold } from "~/fonts.server";
import { TextTypewriterOverlay } from "~/annies/text-typewriter.fn";

export const propsSchema = z.object({
  imageUrl: z.string().url(),
  text: z.string(),
  fontSize: z.number().int().min(1),
  fontColor: z.string().optional(),
});

export type SimpleSlideshowCoverProps = z.infer<typeof propsSchema>;

export const previewProps: SimpleSlideshowCoverProps = {
  imageUrl: "https://static.effing.dev/picsum/1080/1920/plants.jpg",
  text: "Hello World!",
  fontSize: 64,
};

export async function runner({
  props: { imageUrl, text, fontSize, fontColor = "#ffffff" },
  dimensions: { width, height },
}: RunnerArgs<SimpleSlideshowCoverProps>): ImageRunnerReturn {
  const fonts = await loadFonts([interSemiBold]);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await renderReactElement(
    ctx,
    <div
      style={{
        width,
        height,
        display: "flex",
        backgroundImage: `url(${imageUrl})`,
      }}
    >
      <TextTypewriterOverlay
        text={text}
        fontSize={fontSize}
        fontColor={fontColor}
        horizontalAlignment="center"
        verticalAlignment="center"
        cursorShown={false}
      />
    </div>,
    { fonts },
  );

  return canvas.encode("jpeg");
}
