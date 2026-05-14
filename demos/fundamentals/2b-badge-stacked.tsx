import { createWriteStream, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { effieData, effieWebUrl } from "@effing/effie";
import { EffieRenderer } from "@effing/ffs";
import { createCanvas, renderReactElement } from "@effing/canvas";

const width = 1080;
const height = 1920;

const titleCanvas = createCanvas(width, height);
const titleCtx = titleCanvas.getContext("2d");

await renderReactElement(
  titleCtx,
  <div
    style={{
      width,
      height,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1A1A2E",
      padding: 80,
    }}
  >
    <div
      style={{
        fontSize: 80,
        fontWeight: 700,
        color: "#E94560",
        marginBottom: 24,
      }}
    >
      My Video
    </div>
    <div
      style={{
        fontSize: 40,
        color: "#FFFFFF",
        opacity: 0.8,
        textAlign: "center",
      }}
    >
      Built with Effing
    </div>
  </div>,
);

const titlePng = await titleCanvas.encode("png");
const titleUrl = effieWebUrl(
  `data:image/png;base64,${titlePng.toString("base64")}`,
);

const badgeCanvas = createCanvas(width, height);
const badgeCtx = badgeCanvas.getContext("2d");

await renderReactElement(
  badgeCtx,
  <div
    style={{
      width,
      height,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "flex-end",
      padding: 160,
    }}
  >
    <div
      style={{
        fontSize: 48,
        fontWeight: 700,
        textBox: "trim-both cap alphabetic",
        color: "#FFFFFF",
        backgroundColor: "#E94560",
        padding: "32px 40px",
        borderRadius: 8,
        transform: "rotate(-8deg)",
        letterSpacing: 2,
        boxShadow: "0 4px 20px rgba(255, 0, 0, 0.33)",
      }}
    >
      NO BROWSERS
    </div>
  </div>,
);

const badgePng = await badgeCanvas.encode("png");
const badgeUrl = effieWebUrl(
  `data:image/png;base64,${badgePng.toString("base64")}`,
);

const video = effieData({
  width,
  height,
  fps: 30,
  cover: titleUrl,
  background: { type: "color", color: "#1A1A2E" },
  segments: [
    {
      duration: 2.5,
      layers: [
        {
          type: "image",
          source: titleUrl,
          effects: [{ type: "fade-in", start: 0, duration: 1 }],
        },
        {
          type: "image",
          source: badgeUrl,
          delay: 0.5,
          effects: [{ type: "fade-in", start: 0, duration: 0.3 }],
          motion: {
            type: "slide",
            direction: "left",
            duration: 0.3,
            distance: 0.5,
            easing: "ease-out",
          },
        },
      ],
    },
    {
      duration: 4,
      transition: { type: "slice", direction: "up", duration: 0.5 },
      layers: [
        {
          type: "image",
          source: `https://static.effing.dev/picsum/${1080 * 1.5}/1920/sea.jpg`,
          effects: [
            { type: "scroll", direction: "left", distance: 0.5, duration: 4 },
          ],
          motion: {
            type: "slide",
            direction: "up",
            duration: 1,
            distance: 0.1,
            easing: "ease-out",
          },
        },
      ],
      audio: {
        source:
          "https://static.effing.dev/pixabay/trading_nation-deep-strange-whoosh-183845.mp3",
      },
    },
  ],
});

mkdirSync("out", { recursive: true });
const renderer = new EffieRenderer(video);
const outPath = "out/2b-badge-stacked.mp4";
try {
  await pipeline(await renderer.render(), createWriteStream(outPath));
  console.log(`Video written to ${outPath}`);
} finally {
  renderer.close();
}
