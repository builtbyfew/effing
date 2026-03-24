import { createWriteStream } from "fs";
import { effieData, effieWebUrl } from "@effing/effie";
import { EffieRenderer } from "@effing/ffs";
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { FontData } from "@effing/canvas";
import { annieBuffer } from "@effing/annie";
import { tween, easeInOutCubic } from "@effing/tween";

// --- Font ---

const boldInter: FontData = {
  name: "Inter",
  data: await fetch(
    "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
  ).then((r) => r.arrayBuffer()),
  weight: 700,
  style: "normal",
};

const width = 1080;
const height = 1920;
const fonts = [boldInter];

// --- Title card (canvas → PNG → data URL) ---

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
        fontFamily: "Inter",
        color: "#E94560",
        marginBottom: 24,
      }}
    >
      My Video
    </div>
    <div
      style={{
        fontSize: 40,
        fontFamily: "Inter",
        color: "#FFFFFF",
        opacity: 0.8,
        textAlign: "center",
      }}
    >
      Built with Effing
    </div>
  </div>,
  { fonts },
);

const titlePng = await titleCanvas.encode("png");
const titleUrl = effieWebUrl(
  `data:image/png;base64,${titlePng.toString("base64")}`,
);

// --- Badge overlay (canvas → PNG → data URL) ---

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
        fontFamily: "Inter",
        color: "#FFFFFF",
        backgroundColor: "#E94560",
        padding: "16px 40px",
        borderRadius: 8,
        transform: "rotate(-8deg)",
        letterSpacing: 2,
        boxShadow: "0 4px 20px rgba(255, 0, 0, 0.33)",
      }}
    >
      NO BROWSERS
    </div>
  </div>,
  { fonts },
);

const badgePng = await badgeCanvas.encode("png");
const badgeUrl = effieWebUrl(
  `data:image/png;base64,${badgePng.toString("base64")}`,
);

// --- Progress bar animation (canvas → frames → annie → data URL) ---

async function* generateFrames(
  width: number,
  height: number,
  fonts: FontData[],
) {
  const frameCount = 90; // 3 seconds at 30fps

  yield* tween(frameCount, async ({ lower: progress }) => {
    const eased = easeInOutCubic(progress);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    await renderReactElement(
      ctx,
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontFamily: "Inter",
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: 40,
          }}
        >
          {Math.round(eased * 100)}%
        </div>
        <div
          style={{
            width: width - 160,
            height: 24,
            backgroundColor: "#333333",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              width: (width - 160) * eased,
              height: 24,
              backgroundColor: "#E94560",
              borderRadius: 12,
            }}
          />
        </div>
      </div>,
      { fonts },
    );

    return canvas.encode("png");
  });
}

const annie = await annieBuffer(generateFrames(width, height, fonts));
const annieUrl = effieWebUrl(
  `data:application/x-tar;base64,${annie.toString("base64")}`,
);

// --- Compose and render ---

const video = effieData({
  width: 1080,
  height: 1920,
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
      duration: 3.5,
      transition: { type: "fade", duration: 0.5 },
      layers: [
        {
          type: "animation",
          source: annieUrl,
          motion: { type: "bounce" },
        },
      ],
      audio: {
        source:
          "https://static.effing.dev/pixabay/audiopapkin-sound-design-elements-sfx-ps-022-302865.mp3",
      },
    },
    {
      duration: 4,
      transition: { type: "slice", direction: "up", duration: 0.5 },
      layers: [
        {
          type: "image",
          source: `https://picsum.photos/id/27/${1080 * 1.5}/1920`,
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

const renderer = new EffieRenderer(video);
const stream = await renderer.render();
const outPath = "output.mp4";
stream.pipe(createWriteStream(outPath));
stream.on("end", () => {
  renderer.close();
  console.log(`Video written to ${outPath}`);
});
