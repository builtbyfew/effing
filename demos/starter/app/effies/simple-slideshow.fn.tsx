import { z } from "zod";
import { effieData, effieSegment } from "@effing/effie";
import { fnUrl } from "@effing/fn";
import type { RunnerArgs, EffieRunnerReturn } from "@effing/fn";
import type { PhotoZoomProps } from "~/annies/photo-zoom.fn";
import type { TextTypewriterProps } from "~/annies/text-typewriter.fn";
import type { SimpleSlideshowCoverProps } from "~/images/simple-slideshow-cover.fn";

export const propsSchema = z.object({
  slides: z.array(
    z.object({
      text: z.string(),
      imageUrl: z.string().url(),
      duration: z.number().positive(),
    }),
  ),
});

type SimpleSlideshowProps = z.infer<typeof propsSchema>;

export const previewProps: SimpleSlideshowProps = {
  slides: [
    {
      text: "How effing awesome is this?",
      imageUrl: "https://picsum.photos/seed/slide1/1080/1920",
      duration: 6,
    },
    {
      text: "Create beautiful videos 🤩",
      imageUrl: "https://picsum.photos/seed/slide2/1080/1920",
      duration: 5,
    },
    {
      text: "With total ease 😎",
      imageUrl: "https://picsum.photos/seed/slide3/1080/1920",
      duration: 4,
    },
  ],
};

export async function runner({
  props: { slides },
  dimensions: { width, height },
}: RunnerArgs<SimpleSlideshowProps>): EffieRunnerReturn {
  const cover = await fnUrl(
    "image",
    "simple-slideshow-cover",
    {
      imageUrl: slides[0].imageUrl,
      text: slides[0].text,
      fontSize: Math.round(width * 0.06),
      fontColor: "#ffffff",
    } satisfies SimpleSlideshowCoverProps,
    { width, height },
  );

  return effieData({
    width,
    height,
    fps: 30,
    cover,
    background: { type: "color", color: "black" },
    segments: await Promise.all(
      slides.map(async (slide, i) => {
        const direction = (["left", "right"] as const)[i % 2];

        return effieSegment({
          duration: slide.duration,
          transition:
            i > 0
              ? {
                  type: "slide",
                  direction,
                  duration: 1,
                }
              : undefined,
          layers: [
            {
              type: "animation",
              source: await fnUrl(
                "annie",
                "photo-zoom",
                {
                  imageUrl: slide.imageUrl,
                  frameCount: slide.duration * 30,
                  zoomLevel: 0.2,
                } satisfies PhotoZoomProps,
                { width: width * 1.2, height },
              ),
              effects: [
                {
                  type: "scroll",
                  direction,
                  duration: slide.duration,
                  distance: 0.2,
                },
              ],
            },
            {
              type: "animation",
              source: await fnUrl(
                "annie",
                "text-typewriter",
                {
                  text: slide.text,
                  fontSize: Math.round(width * 0.06),
                  fontColor: "#ffffff",
                  typingFrameCount: Math.min(slide.text.length * 3, 60),
                  blinkingFrameCount: Math.round((slide.duration - 2) * 30),
                  horizontalAlignment: "center",
                  verticalAlignment: "center",
                } satisfies TextTypewriterProps,
                { width, height },
              ),
              delay: 1,
              effects:
                i === slides.length - 1
                  ? [
                      {
                        type: "fade-out",
                        duration: 0.5,
                        start: slide.duration - 0.5,
                      },
                    ]
                  : undefined,
            },
          ],
        });
      }),
    ),
  });
}
