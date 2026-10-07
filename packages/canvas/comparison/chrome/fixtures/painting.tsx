import type React from "react";
import { PNG } from "pngjs";
import { BlurShowcaseCard } from "../../_fixtures/image-cards.tsx";
import { fixtureModule } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";

// Painting, compared pixel by pixel with Chrome's screenshot: a 240×120
// frame of white, with what's painted on it.

const painted = (
  name: string,
  children: React.ReactNode,
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width: 240,
  height: 120,
  screenshot: true,
  element: (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: 240,
        height: 120,
        padding: 10,
        gap: 10,
        backgroundColor: "white",
        fontFamily: "Liberation Sans",
        fontSize: 20,
      }}
    >
      {children}
    </div>
  ),
  ...rest,
});

/** A gradient image, as `makeTestImage` makes it. */
function testImage(width: number, height: number): string {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      png.data[i] = Math.floor((x / width) * 255);
      png.data[i + 1] = Math.floor((y / height) * 255);
      png.data[i + 2] = 128;
      png.data[i + 3] = 255;
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

export default fixtureModule("painting", [
  painted("boxes", [
    <div
      key="a"
      id="a"
      style={{ width: 100, height: 40, backgroundColor: "#3b82f6" }}
    />,
    <div
      key="b"
      id="b"
      style={{
        width: 160,
        height: 40,
        backgroundColor: "#fde68a",
        border: "4px solid #b45309",
        borderRadius: 12,
      }}
    />,
  ]),
  painted("a linear gradient", [
    <div
      key="g"
      id="g"
      style={{
        width: 220,
        height: 100,
        backgroundImage: "linear-gradient(90deg, #ef4444, #3b82f6)",
      }}
    />,
  ]),
  painted("text", [
    <div key="t" id="t" style={{ width: 220 }}>
      The quick brown fox jumps over the lazy dog.
    </div>,
  ]),
  painted("underlined text", [
    <div key="t" id="t" style={{ textDecoration: "underline" }}>
      Underlined text
    </div>,
    <div key="u" id="u" style={{ textDecoration: "line-through" }}>
      Struck through
    </div>,
  ]),
  painted("text with a shadow", [
    <div
      key="t"
      id="t"
      style={{ fontSize: 32, textShadow: "3px 3px 0 #ef4444" }}
    >
      Shadowed
    </div>,
  ]),
  // image.test.tsx's card, whose pixels it holds where the blurred image
  // fades out over the page, as Chrome painted them.
  {
    name: "a blurred image",
    width: 400,
    height: 300,
    screenshot: true,
    element: (
      <BlurShowcaseCard
        width={400}
        height={300}
        imageDataUri={testImage(120, 120)}
      />
    ),
    // image.test.tsx holds these to 3 levels, but 4 of them are 4 to 6
    // levels from this Chrome's: they're within 1 of canvas's own.
    transcribedPixels: {
      within: 6,
      pixels: [
        [378, 150, [206, 131, 133]],
        [381, 150, [215, 154, 156]],
        [383, 150, [225, 180, 183]],
        [385, 150, [235, 210, 212]],
        [387, 150, [243, 233, 235]],
        [390, 150, [247, 248, 250]],
        [296, 10, [243, 240, 247]],
        [296, 13, [221, 194, 224]],
        [296, 15, [194, 140, 197]],
        [296, 17, [166, 82, 168]],
        [296, 19, [142, 36, 145]],
        [296, 22, [128, 8, 130]],
        [386, 286, [247, 249, 250]],
      ],
    },
  },
]);
