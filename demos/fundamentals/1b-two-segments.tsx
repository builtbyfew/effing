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
          source: "https://static.effing.dev/picsum/1080/1920/sea.jpg",
        },
      ],
    },
  ],
});

mkdirSync("out", { recursive: true });
const renderer = new EffieRenderer(video);
const outPath = "out/1b-two-segments.mp4";
try {
  await pipeline(await renderer.render(), createWriteStream(outPath));
  console.log(`Video written to ${outPath}`);
} finally {
  renderer.close();
}
