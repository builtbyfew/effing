# Tutorial

This tutorial walks you through building a video with Effing, step by step. You'll start with a simple declarative composition, then generate custom images and animations programmatically.

We're starting from scratch here so you can understand each piece individually. At the end, we'll point you to `@effing/create`, which ties everything together in a proper framework.

## Prerequisites

- Node.js 22+
- A new project with the packages we'll use:

```bash
npm init -y
npm install @effing/effie @effing/ffs @effing/canvas @effing/annie @effing/tween react
npm install -D tsx
```

We'll use `tsx` to run our TypeScript files. Files that contain JSX use the `.tsx` extension.

> A `tsconfig.json` is not required to complete this tutorial, but if you want editor support (autocomplete, type checking), you can add one:
>
> ```json
> { "compilerOptions": { "jsx": "react-jsx", "module": "nodenext" } }
> ```

## 1. Your First Effie Composition

An Effie is a JSON object that declaratively describes a video: its dimensions, frame rate, background, and a sequence of segments containing visual layers. Let's start with the simplest possible composition. Create a file called `video.ts`:

```typescript
import { effieData } from "@effing/effie";

const video = effieData({
  width: 1080,
  height: 1920,
  fps: 30,
  cover: "https://picsum.photos/seed/tutorial/1080/1920",
  background: { type: "color", color: "#1A1A2E" },
  segments: [
    {
      duration: 4,
      layers: [
        {
          type: "image",
          source: "https://picsum.photos/seed/tutorial/1080/1920",
        },
      ],
    },
  ],
});
```

This defines a 4-second, 1080x1920 video at 30fps with a single image layer.

The `cover` is a static image used as a thumbnail or preview — for example, when displaying the video before it starts playing. It's always required.

The background is required too, but you won't actually see it here since the image layer covers the full frame. It becomes visible during transitions, behind transparent layers, or when layers don't fill the entire frame.

### Rendering to MP4

To turn this into an actual video, we can use FFS. It takes an Effie composition, builds an FFmpeg filter chain, fetches all sources by URL, and produces an MP4. FFS has both a library API and a standalone HTTP server — here we'll use the library. Add this to the bottom of your file:

```typescript
import { createWriteStream } from "fs";
import { EffieRenderer } from "@effing/ffs";

const renderer = new EffieRenderer(video);
const stream = await renderer.render();
stream.pipe(createWriteStream("output.mp4"));
stream.on("end", () => renderer.close());
```

Run it with `npx tsx video.ts` and you'll get an `output.mp4`.

### Adding a Second Segment

Let's make this more interesting by adding a second segment with a transition. Update the `segments` array:

```typescript
segments: [
  {
    duration: 4,
    layers: [
      {
        type: "image",
        source: "https://picsum.photos/seed/tutorial/1080/1920",
      },
    ],
  },
  {
    duration: 4,
    transition: { type: "slice", direction: "up", duration: 0.5 },
    layers: [
      {
        type: "image",
        source: "https://picsum.photos/id/27/1080/1920",
      },
    ],
  },
],
```

The second image slices in over 0.5 seconds. Effie supports [many transition types](../packages/effie/README.md#transitions): `fade`, `slide`, `wipe`, `zoom`, `dissolve`, `barn`, `circle`, `pixelize`, and more.

### Effects and Motion

Layers can have effects and motion applied to them, without any custom frame rendering. Let's add some to our second segment:

```typescript
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
},
```

Here we're using a wider image (1.5x the video width) and scrolling it to the left over the full duration, creating a panning effect. A slide motion eases the image upward at the start.

**Effects** transform the visual appearance over time:

- `fade-in` / `fade-out` — opacity transitions
- `saturate-in` / `saturate-out` — color saturation transitions
- `scroll` — pans the layer in a direction over its duration

**Motion** animates the layer's position:

- `bounce` — vertical bouncing
- `shake` — random jittering
- `slide` — moves in a direction, with optional easing (`ease-in`, `ease-out`, `ease-in-out`)

You can combine multiple effects with one motion on the same layer. This covers a lot of common video animations — you only need to generate custom frames when you want something more specific.

### Audio

Segments can have their own audio. Let's add a sound effect to our second segment:

```typescript
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
```

Audio supports `volume`, `fadeIn`, `fadeOut`, and `seek` for fine-grained control. You can also set a global `audio` on the composition itself for a background soundtrack.

## 2. Generating Images with Canvas

So far we've used external image URLs. But what if you want to generate images programmatically — say, a title card with custom text and styling? That's what `@effing/canvas` is for. It provides a server-side Skia canvas that, in addition to the standard canvas API, can render JSX elements with flexbox layout, CSS properties, fonts, emoji, gradients, and more.

Since we're using JSX from here on, rename your file to `video.tsx`. The `.tsx` extension tells `tsx` to handle JSX syntax.

### Rendering a PNG

Add these imports and generate a title card before the composition:

```typescript
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { FontData } from "@effing/canvas";

// Load a font (required for text rendering)
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
```

### Using it in the Composition

Convert the PNG buffer to a data URL and use it as a layer source. The `effieWebUrl` helper validates and narrows the string to Effie's URL type:

```typescript
import { effieData, effieWebUrl } from "@effing/effie";

const titleUrl = effieWebUrl(
  `data:image/png;base64,${titlePng.toString("base64")}`,
);
```

Now replace the first segment with our generated title card:

```typescript
{
  duration: 2.5,
  layers: [
    {
      type: "image",
      source: titleUrl,
      effects: [{ type: "fade-in", start: 0, duration: 1 }],
    },
  ],
},
```

We can also use `titleUrl` as the `cover`, since it's a good preview image for the video.

### Stacking Layers

Each segment can have multiple layers, drawn bottom to top. Let's put that to use by generating a badge overlay that we can stack on top of the title card:

```typescript
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
```

Now add it as a second layer in the title card segment. It slides in from the right and fades in after a short delay:

```typescript
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
```

Layers are drawn bottom to top, so the badge renders on top of the title card. You can use `delay`, `from`, and `until` to [control when each layer appears](../packages/effie/README.md#segments--layers).

## 3. Creating Annie Animations

Effects and motions cover many cases, but sometimes you need full frame-by-frame control — a typewriter effect, a custom chart animation, a particle system. That's what Annies are for.

An Annie is a TAR archive of sequentially-named PNG (or JPEG) frames. You generate the frames however you like — `@effing/canvas` is a natural fit, but anything that produces PNGs works — package them into a TAR, and reference it in your Effie as an `"animation"` layer.

### Generating Frames with Tween

`@effing/tween` provides a `tween()` function that iterates over a number of frames, giving you a progress value from 0 to 1 for each. It processes frames concurrently for speed, but yields them in order.

Here's a simple example that animates a progress bar filling up:

```typescript
import { tween, easeInOutCubic } from "@effing/tween";

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
```

The `lower` property gives you the progress at the start of each frame interval (0 to 1). Apply an easing function to shape the animation curve — `easeInOutCubic` starts slow, speeds up, then slows down again.

### Packaging as an Annie

Wrap the frame generator with `annieBuffer` to produce a TAR archive:

```typescript
import { annieBuffer } from "@effing/annie";

const annie = await annieBuffer(generateFrames(width, height, fonts));
const annieUrl = effieWebUrl(
  `data:application/x-tar;base64,${annie.toString("base64")}`,
);
```

### The Final Composition

Now let's put it all together. We insert the annie as a middle segment between the title card and the photo, add a bounce motion, and give it its own audio:

```typescript
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
          effects: [{ type: "fade-in", start: 0, duration: 0.5 }],
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
```

Three segments — a generated title card, an animated progress bar with bounce, and a panning photo — each with their own transition and audio. The complete code is in [`demos/tutorial/video.tsx`](../demos/tutorial/video.tsx).

## How It All Fits Together

One of the key insights behind Effing is that **everything is a URL**.

An Effie composition doesn't know or care how its assets were created. It just references them by URL:

- A static image hosted somewhere? Just a URL.
- A PNG generated by canvas? Encode it as a `data:` URL, or serve it from an HTTP endpoint.
- An Annie animation? A TAR behind a URL — serve it from your API, store it in a CDN, or inline it as a data URL.

This means generation and rendering are fully decoupled. You can generate your annies and images on one server (or at build time), host them anywhere, and compose them into an Effie that FFS renders into a video. You can mix static assets with programmatically generated ones freely.

In this tutorial we used `data:` URLs to keep things self-contained, but things tend to click together nicely when you serve your annies and images as HTTP endpoints — each piece becomes a URL that composes with everything else. That's exactly what `@effing/create` sets up for you: run `npm create @effing my-effing-app` and you get a project where each annie is an HTTP route, each effie composes them by URL, and the whole thing can be previewed in the browser or rendered to video. It's an architecture that should feel very familiar if you've built for the web before.

It goes a step further, too: the props for each annie are serialized directly into the URL. An annie URL doesn't just point to an animation — it _is_ the animation, fully parameterized. Change the text, the font size, or the color, and you get a different URL that produces a different animation. In that sense, URLs act like components: self-contained, reusable, and composable. And they'll get cached automatically by browsers and CDNs.

## Next Steps

- **Try the starter** with `npm create @effing my-effing-app`
- **Browse the API docs** at [`docs/api/`](api/README.md) for the full reference
- **Explore each package** via their READMEs: [`@effing/effie`](../packages/effie/README.md), [`@effing/canvas`](../packages/canvas/README.md), [`@effing/annie`](../packages/annie/README.md), [`@effing/tween`](../packages/tween/README.md), [`@effing/ffs`](../packages/ffs/README.md)
