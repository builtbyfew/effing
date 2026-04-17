# Effing Starter Demo

A complete example application demonstrating how to build Annies (animations) and Effies (video compositions) using the `@effing/*` packages.

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
│   ├── annies/              # Annie animation definitions
│   │   ├── index.ts         # Annie registry and types
│   │   └── *.annie.tsx      # Annies
│   ├── effies/              # Effie composition definitions
│   │   ├── index.ts         # Effie registry and types
│   │   └── *.effie.tsx      # Effies
│   ├── routes/
│   │   ├── _index.tsx                   # Homepage listing all annies/effies
│   │   ├── annie.$segment.tsx           # Annie TAR streaming endpoint
│   │   ├── effie.$segment.tsx           # Effie JSON endpoint
│   │   ├── image.$segment.tsx           # Image rendering endpoint
│   │   ├── preview.annie.$annieId.tsx   # Annie preview page
│   │   ├── preview.effie.$effieId.tsx   # Effie preview page
│   │   └── preview.image.$imageId.tsx   # Image preview page
│   ├── fonts.server.ts      # Font definitions and loading utils
│   └── urls.server.ts       # URL generation helpers
└── vite.config.ts
```

## Creating Annies

Annies are frame-based animations. Create a file at `app/annies/*.annie.tsx`:

```typescript
// app/annies/my-animation.annie.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import { tween, easeOutQuad } from "@effing/tween";
import type { AnnieRendererArgs } from ".";

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
export async function* renderer({
  props: { text, frameCount = 60 },
  width,
  height,
}: AnnieRendererArgs<MyAnimationProps>): AsyncGenerator<Buffer> {
  const fonts = await loadFonts([myFont]);

  yield* tween(frameCount, async ({ lower: progress }) => {
    const scale = 1 + 0.3 * easeOutQuad(progress);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    await renderReactElement(
      ctx,
      <div style={{
        width, height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 72,
        transform: `scale(${scale})`,
      }}>
        {text}
      </div>,
      { fonts }
    );
    return canvas.encode("png");
  });
}
```

The Annie will automatically appear on the homepage and be accessible at:

- **Preview:** `/preview/annie/my-animation`
- **TAR stream:** `/annie/{signed-segment}?w=1080&h=1080`

## Creating Effies

Effies are video compositions that combine Annies, images, audio, and effects. Create a file at `app/effies/*.effie.tsx`:

```typescript
// app/effies/my-video.effie.tsx
import { z } from "zod";
import { effieData, effieSegment } from "@effing/effie";
import { annieUrl } from "~/urls.server";
import type { EffieRendererArgs } from ".";

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
export async function renderer({
  props: { title, imageUrl },
  width,
  height,
}: EffieRendererArgs<MyVideoProps>) {
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
            source: await annieUrl({
              annieId: "text-typewriter",
              props: { text: title, fontSize: 72 },
              width,
              height,
            }),
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

Lists all available Annies and Effies with links to their preview pages.

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

### Annie Stream (`/annie/:segment`)

Serves Annie TAR archives. The segment is a signed payload containing:

- `annieId` — Which Annie to render
- Props — Animation parameters

### Effie JSON (`/effie/:segment`)

Serves Effie JSON. The segment is a signed payload containing:

- `effieId` — Which Effie to render
- Props — Composition parameters

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

The `urls.server.ts` module provides helpers for generating URLs to be used in effies:

```typescript
import { annieUrl } from "~/urls.server";

// Generate signed Annie URL
const url = await annieUrl({
  annieId: "text-typewriter",
  props: { text: "Hello", fontSize: 72 },
  width: 1080,
  height: 1920,
});
```

## Rendering Videos

The preview page can render videos if FFS is configured:

1. Set `FFS_BASE_URL` and `FFS_API_KEY` environment variables
2. Open an Effie preview page (`/preview/effie/:effieId`)
3. Click "Render it FFS" to send the composition to the rendering service
4. The rendered video appears in place of the cover image

You can also render at different scales (33%, 67%, 100%, 200%) for faster previews or higher quality output.

In production, you'd use an FFS server directly to render effies. Point FFS at your `/effie/:segment` endpoint and it will fetch the effie JSON, resolve all annie URLs, and produce the final video.
