import { z } from "zod";
import { interBold, loadFonts } from "~/fonts.server";
import { tween } from "@effing/tween";
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { RunnerArgs, AnnieRunnerReturn } from "@effing/fn";

export const propsSchema = z.object({
  text: z.string(),
  fontSize: z.number().int().min(1),
  fontFamily: z.enum(["Inter", "Roboto", "Open Sans"]).optional(),
  fontColor: z.string().optional(),
  typingFrameCount: z.number().int().min(10).optional(),
  blinkingFrameCount: z.number().int().min(0).optional(),
  horizontalAlignment: z.enum(["left", "center", "right"]).optional(),
  verticalAlignment: z.enum(["top", "center", "bottom"]).optional(),
});

export type TextTypewriterProps = z.infer<typeof propsSchema>;

export const previewProps: TextTypewriterProps = {
  text: "Hello World!",
  fontSize: 72,
  fontFamily: "Inter",
  fontColor: "#ffffff",
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

export async function* runner({
  props: {
    text,
    fontSize,
    fontFamily = "Inter",
    fontColor = "#ffffff",
    typingFrameCount,
    blinkingFrameCount = 60,
    horizontalAlignment = "center",
    verticalAlignment = "center",
  },
  dimensions: { width, height },
}: RunnerArgs<TextTypewriterProps>): AnnieRunnerReturn {
  const fonts = await loadFonts([interBold]);

  if (!typingFrameCount) {
    typingFrameCount = text.length * 3;
  }

  // Typing phase
  yield* tween(typingFrameCount, async ({ lower: p }) => {
    const charsShown = Math.floor(p * text.length);
    const textToShow = text.slice(0, charsShown);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    await renderReactElement(
      ctx,
      <TextTypewriterOverlay
        text={textToShow}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontColor={fontColor}
        horizontalAlignment={horizontalAlignment}
        verticalAlignment={verticalAlignment}
        cursorShown={true}
      />,
      { fonts },
    );
    return canvas.encode("png");
  });

  // Blinking cursor phase
  yield* tween(blinkingFrameCount, async ({ lower: p }) => {
    const cursorShown = Math.floor(p * 5) % 2 === 1;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    await renderReactElement(
      ctx,
      <TextTypewriterOverlay
        text={text}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontColor={fontColor}
        horizontalAlignment={horizontalAlignment}
        verticalAlignment={verticalAlignment}
        cursorShown={cursorShown}
      />,
      { fonts },
    );
    return canvas.encode("png");
  });
}

export function TextTypewriterOverlay({
  text,
  fontFamily = "Inter",
  fontSize,
  fontColor = "#ffffff",
  horizontalAlignment = "center",
  verticalAlignment = "center",
  cursorShown,
}: {
  text: string;
  fontFamily?: string;
  fontSize: number;
  fontColor?: string;
  horizontalAlignment?: "left" | "center" | "right";
  verticalAlignment?: "top" | "center" | "bottom";
  cursorShown: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: { top: "flex-start", center: "center", bottom: "flex-end" }[
          verticalAlignment
        ],
        justifyContent: {
          left: "flex-start",
          center: "center",
          right: "flex-end",
        }[horizontalAlignment],
        padding: 40,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: fontSize,
          fontWeight: "bold",
          color: fontColor,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          textAlign: horizontalAlignment,
          whiteSpace: "nowrap",
        }}
      >
        {text}
        <span
          style={{
            height: fontSize,
            width: 3,
            display: "block",
            backgroundColor: fontColor,
            marginLeft: 4,
            verticalAlign: "middle",
            opacity: Number(cursorShown),
          }}
        />
      </div>
    </div>
  );
}
