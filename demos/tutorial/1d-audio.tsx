import { createWriteStream, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { effieData } from "@effing/effie";
import { EffieRenderer } from "@effing/ffs";

const video = effieData({
  width: 1080,
  height: 1920,
  fps: 30,
  cover: "https://static.effing.dev/picsum/1080/1920/water.jpg",
  background: { type: "color", color: "#1A1A2E" },
  segments: [
    {
      duration: 2.5,
      layers: [
        {
          type: "image",
          source: "https://static.effing.dev/picsum/1080/1920/water.jpg",
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
const outPath = "out/1d-audio.mp4";
try {
  await pipeline(await renderer.render(), createWriteStream(outPath));
  console.log(`Video written to ${outPath}`);
} finally {
  renderer.close();
}
