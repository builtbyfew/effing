# Effing Starter Demo

A complete example application demonstrating how to build Images, Annies (animations), and Effies (video compositions) using the `@effing/*` packages.

## Getting Started

```bash
cd demos/starter
pnpm install
cp .env.example .env
pnpm dev
```

Open [http://localhost:3839](http://localhost:3839) to see the demo.

## Project Structure

```
demos/starter/
├── app/
│   ├── images/              # Single-image fns
│   │   └── *.fn.tsx
│   ├── annies/              # Animation fns
│   │   └── *.fn.tsx
│   ├── effies/              # Composition fns
│   │   └── *.fn.tsx
│   ├── routes/
│   │   ├── _index.tsx                   # Homepage listing all images/annies/effies
│   │   ├── annie.$segment.tsx           # Annie TAR streaming endpoint
│   │   ├── effie.$segment.tsx           # Effie JSON endpoint
│   │   ├── image.$segment.tsx           # Image rendering endpoint
│   │   ├── preview.annie.$annieId.tsx   # Annie preview page
│   │   ├── preview.effie.$effieId.tsx   # Effie preview page
│   │   └── preview.image.$imageId.tsx   # Image preview page
│   ├── fn.server.ts         # Wires the @effing/fn runtime to the app
│   ├── fonts.server.ts      # Font definitions and loading utils
│   └── urls.server.ts       # Signed URL segment helpers
└── vite.config.ts
```

Fns of all three kinds (image, annie, effie) share one module shape: a `propsSchema`, a `previewProps`, and an exported `runner`. They live in `app/{images,annies,effies}/*.fn.tsx` and are auto-discovered by `app/fn.server.ts` via `import.meta.glob`, so just dropping a file in is enough to register it.

## Creating Images

Images are single-frame fns — useful for slideshow covers, thumbnails, or any other one-off rendered still. Create a file at `app/images/*.fn.tsx`:

```tsx
// app/images/my-cover.fn.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { RunnerArgs, ImageRunnerReturn } from "@effing/fn";

export const propsSchema = z.object({
  text: z.string(),
});

type MyCoverProps = z.infer<typeof propsSchema>;

export const previewProps: MyCoverProps = { text: "Hello!" };

export async function runner({
  props: { text },
  bounds: { width, height },
}: RunnerArgs<MyCoverProps>): ImageRunnerReturn {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await renderReactElement(
    ctx,
    <div style={{ width, height, display: "flex" }}>{text}</div>,
  );
  return canvas.encode("jpeg");
}
```

Accessible at `/preview/image/my-cover` and `/image/{signed-segment}`.

## Creating Annies

Annies are frame-based animations. Create a file at `app/annies/*.fn.tsx`:

```tsx
// app/annies/my-animation.fn.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import { tween, easeOutQuad } from "@effing/tween";
import type { RunnerArgs, AnnieRunnerReturn } from "@effing/fn";
import { interBold, loadFonts } from "~/fonts.server";

// 1. Define props schema
export const propsSchema = z.object({
  text: z.string(),
  frameCount: z.number().int().min(1).optional(),
});

type MyAnimationProps = z.infer<typeof propsSchema>;

// 2. Define preview props (used by preview page)
export const previewProps: MyAnimationProps = {
  text: "Hello!",
  frameCount: 60,
};

// 3. Export async generator that yields PNG frames
export async function* runner({
  props: { text, frameCount = 60 },
  bounds: { width, height },
}: RunnerArgs<MyAnimationProps>): AnnieRunnerReturn {
  const fonts = await loadFonts([interBold]);

  yield* tween(frameCount, async ({ lower: progress }) => {
    const scale = 1 + 0.3 * easeOutQuad(progress);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    await renderReactElement(
      ctx,
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 72,
          transform: `scale(${scale})`,
        }}
      >
        {text}
      </div>,
      { fonts },
    );
    return canvas.encode("png");
  });
}
```

The Annie will automatically appear on the homepage and be accessible at:

- **Preview:** `/preview/annie/my-animation`
- **TAR stream:** `/annie/{signed-segment}`

## Creating Effies

Effies are video compositions that combine Annies, images, audio, and effects. Create a file at `app/effies/*.fn.tsx`:

```tsx
// app/effies/my-video.fn.tsx
import { z } from "zod";
import { effieData, effieSegment } from "@effing/effie";
import { fnUrl } from "@effing/fn";
import type { RunnerArgs, EffieRunnerReturn } from "@effing/fn";
import type { TextTypewriterProps } from "~/annies/text-typewriter.fn";

// 1. Define props schema
export const propsSchema = z.object({
  title: z.string(),
  imageUrl: z.string().url(),
});

type MyVideoProps = z.infer<typeof propsSchema>;

// 2. Define preview props
export const previewProps: MyVideoProps = {
  title: "My Video",
  imageUrl: "https://picsum.photos/1080/1920",
};

// 3. Export async function that returns EffieData
export async function runner({
  props: { title, imageUrl },
  bounds: { width, height },
}: RunnerArgs<MyVideoProps>): EffieRunnerReturn {
  return effieData({
    width,
    height,
    fps: 30,
    cover: imageUrl,
    background: { type: "color", color: "black" },
    segments: [
      effieSegment({
        duration: 5,
        layers: [
          {
            type: "animation",
            source: await fnUrl(
              "annie",
              "text-typewriter",
              {
                text: title,
                fontSize: 72,
              } satisfies TextTypewriterProps,
              { width, height },
            ),
          },
        ],
      }),
    ],
  });
}
```

The Effie will automatically appear on the homepage and be accessible at:

- **Preview:** `/preview/effie/my-video`
- **JSON:** `/effie/{signed-segment}?ratio=1:1`

## Routes

### Homepage (`/`)

Lists all available Images, Annies, and Effies with links to their preview pages.

### Image Preview (`/preview/image/:imageId`)

Renders a single image fn using its `previewProps`.

### Annie Preview (`/preview/annie/:annieId`)

Displays an interactive preview of an Annie using `@effing/annie-player`. Shows:

- Playable animation with load/play/pause controls
- Direct URL to the TAR stream

### Effie Preview (`/preview/effie/:effieId`)

Comprehensive preview of an Effie composition using `@effing/effie-preview`. Shows:

- Cover image (or rendered video after clicking "Render it FFS")
- Background preview
- All segments with their layers
- Render button to generate video via FFS

### Image Endpoint (`/image/:segment`)

Serves a rendered image (PNG or JPEG). The segment is a signed payload containing the fn `id`, `props`, and bounds (`width`, `height`).

### Annie Stream (`/annie/:segment`)

Serves Annie TAR archives. The segment is a signed payload containing the fn `id`, `props`, and bounds.

### Effie JSON (`/effie/:segment`)

Serves Effie JSON. The segment is a signed payload containing the fn `id`, `props`, and bounds.

## CDN Caching

Both the `/annie/:segment` and `/effie/:segment` routes can easily be placed behind a CDN in production. Since the segment contains signed, deterministic parameters, the same URL always produces the same output, making them ideal cache keys.

Note also that CDN timeouts are not a concern for the annies, even though they might take a while to generate in practice, because they are streamed frame by frame. The CDN receives data continuously and won't time out waiting for the first byte.

## Environment Variables

```bash
# Required: Base URL for the application
BASE_URL=http://localhost:3839
# Required: Secret for signing URL segments
SECRET_KEY=your-secret-key

# Optional: FFS rendering service
FFS_BASE_URL=http://localhost:2000
FFS_API_KEY=your-ffs-api-key
```

## URL Generation

Inside an effie's `runner`, use `fnUrl` from `@effing/fn` to build a signed URL to any other fn (image, annie, or effie):

```typescript
import { fnUrl } from "@effing/fn";

const url = await fnUrl(
  "annie",
  "text-typewriter",
  { text: "Hello", fontSize: 72 },
  { width: 1080, height: 1920 },
);
```

The runtime's URL builder is configured in `app/fn.server.ts`, which signs the payload via `serializeUrlSegment` from `app/urls.server.ts`.

## Rendering Videos

The preview page can render videos if FFS is configured:

1. Set `FFS_BASE_URL` and `FFS_API_KEY` environment variables
2. Open an Effie preview page (`/preview/effie/:effieId`)
3. Click "Render it FFS" to send the composition to the rendering service
4. The rendered video appears in place of the cover image

You can also render at different scales (33%, 67%, 100%, 200%) for faster previews or higher quality output.

In production, you'd use an FFS server directly to render effies. Point FFS at your `/effie/:segment` endpoint and it will fetch the effie JSON, resolve all annie URLs, and produce the final video.
