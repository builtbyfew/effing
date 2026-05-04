# Guide

This is a React Router app for creating Effing Images, Effing Annies, and Effing Effies with the `@effing/*` packages.

- **Effing Images** — single-frame stills. Useful for slideshow covers, thumbnails, social cards, or any composed graphic.
- **Effing Annies** — frame-based animations, streamed as TAR archives of PNG/JPEG frames. Useful for typewriter text, photo zooms, Ken Burns effects, animated overlays.
- **Effing Effies** — video compositions that assemble images, annies, audio, and effects into an MP4.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

(`pnpm` and `yarn` work the same — substitute as you prefer.)

Open [http://localhost:3839](http://localhost:3839) — the homepage lists every image, annie, and effie in the project with links to their preview pages.

`npm run dev` also runs a local FFS rendering service alongside the app, so the "Render it FFS" button on effie previews works out of the box.

## Project structure

```
.
├── app/
│   ├── images/              # Effing Image fns
│   │   └── *.fn.tsx
│   ├── annies/              # Effing Annie fns
│   │   └── *.fn.tsx
│   ├── effies/              # Effing Effie fns
│   │   └── *.fn.tsx
│   ├── routes/              # React Router routes (preview pages and signed endpoints)
│   ├── fn.server.ts         # Wires the @effing/fn runtime to the app
│   ├── fonts.ts             # Font definitions and loading utils
│   └── urls.server.ts       # Signed URL segment helpers
├── effing-cloud.config.ts
└── vite.config.ts
```

Drop a file into `app/images/`, `app/annies/`, or `app/effies/` and it's automatically registered — no routing or registry edits needed. `app/fn.server.ts` discovers fns via `import.meta.glob`, so registration is implicit in the filename.

## The fn module shape

Every fn — image, annie, or effie — exports the same three things:

- **`propsSchema`** — a Zod schema describing the runner's input.
- **`previewProps`** — a concrete object matching the schema, used by the preview page to render a sample.
- **`runner`** — the function that produces the output. Its return type is what differentiates the three kinds.

A fn's id is its filename without the `.fn.tsx` suffix (`app/annies/my-animation.fn.tsx` → `my-animation`).

## Creating Effing Images

Drop a file into `app/images/`:

```tsx
// app/images/my-cover.fn.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { RunnerArgs, ImageRunnerReturn } from "@effing/fn";
import { interBold, loadFonts } from "~/fonts";

export const propsSchema = z.object({
  text: z.string(),
});
export type MyCoverProps = z.infer<typeof propsSchema>;

export const previewProps: MyCoverProps = { text: "Hello!" };

export async function runner({
  props: { text },
  bounds: { width, height },
}: RunnerArgs<MyCoverProps>): ImageRunnerReturn {
  const fonts = await loadFonts([interBold]);
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
        fontFamily: "Inter",
        fontWeight: 700,
        fontSize: 72,
      }}
    >
      {text}
    </div>,
    { fonts },
  );
  return canvas.encode("jpeg");
}
```

`renderReactElement` lays out a React element with CSS flexbox and rasterizes onto the canvas — JSX in, image bytes out. `@effing/canvas` is satori-like, but a separate implementation with its own feature set — don't assume satori-only props or features carry over. Like satori, it only supports a subset of CSS; `node_modules/@effing/canvas/README.md` documents the subset in detail. You can also draw directly to `ctx` with the standard 2D canvas API; `renderReactElement` is a layout convenience, not the only way in.

Encode as `"jpeg"` for photo-heavy stills, `"png"` when you need transparency or crisp text on solid backgrounds.

The image is accessible at:

- **Preview:** `/preview/image/my-cover`
- **Rendered bytes:** `/image/{signed-segment}`

## Creating Effing Annies

Drop a file into `app/annies/`:

```tsx
// app/annies/my-animation.fn.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import { tween, easeOutQuad } from "@effing/tween";
import type { RunnerArgs, AnnieRunnerReturn } from "@effing/fn";
import { interBold, loadFonts } from "~/fonts";

export const propsSchema = z.object({
  text: z.string(),
  frameCount: z.number().int().min(1).optional(),
});
export type MyAnimationProps = z.infer<typeof propsSchema>;

export const previewProps: MyAnimationProps = {
  text: "Hello!",
  frameCount: 60,
};

export async function* runner({
  props: { text, frameCount = 60 },
  bounds: { width, height },
}: RunnerArgs<MyAnimationProps>): AnnieRunnerReturn {
  const fonts = await loadFonts([interBold]);

  yield* tween(frameCount, async ({ lower: p }) => {
    const scale = 1 + 0.3 * easeOutQuad(p);
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
          fontFamily: "Inter",
          fontWeight: 700,
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

The runner is an async generator that yields one encoded frame at a time. `tween(count, callback)` from `@effing/tween` calls the callback `count` times — once per frame — and yields whatever buffer it returns. The callback receives `{ lower, upper }` — the start and end positions of the frame in the `[0, 1]` timeline. For the first frame `lower` is `0`; for the last `upper` is `1`. Pass `lower: p` to sample at the frame's start, or `upper: p` to sample at its end. `@effing/tween` exports the standard Penner easing functions (`easeOutQuad`, `easeInOutCubic`, etc.) for non-linear motion.

Multi-phase animations chain `yield* tween(...)` blocks back-to-back — one tween per phase, e.g. a typing phase followed by a blinking-cursor phase in a typewriter animation.

Encode each frame as `"png"` for text/alpha-heavy frames, `"jpeg"` for photo-heavy frames — JPEG is typically both faster to encode and smaller on the wire, which adds up across an animation.

The annie is accessible at:

- **Preview:** `/preview/annie/my-animation`
- **TAR stream:** `/annie/{signed-segment}`

Frames are streamed as they're rendered, so the TAR endpoint won't time out behind a CDN even for long animations.

## Creating Effing Effies

An effie is a sequence of segments holding image and animation layers, optional segment-level audio, and optional transitions between segments. The runner returns a _description_ of the composition — an `effieData` value — not rendered pixels. Rendering happens separately by FFS, which fetches the layer URLs and assembles the MP4.

Drop a file into `app/effies/`:

```tsx
// app/effies/my-video.fn.tsx
import { z } from "zod";
import { effieData, effieSegment } from "@effing/effie";
import { fnUrl } from "@effing/fn";
import type { RunnerArgs, EffieRunnerReturn } from "@effing/fn";
import type { MyAnimationProps } from "~/annies/my-animation.fn";

export const propsSchema = z.object({
  title: z.string(),
  imageUrl: z.string().url(),
});
type MyVideoProps = z.infer<typeof propsSchema>;

export const previewProps: MyVideoProps = {
  title: "My Video",
  imageUrl: "https://picsum.photos/1080/1920",
};

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
              "my-animation",
              {
                text: title,
                frameCount: 150,
              } satisfies MyAnimationProps,
              { width, height },
            ),
          },
        ],
      }),
    ],
  });
}
```

A few things to know:

- **Independent elements belong on their own layers.** Use one layer per visually independent element (each its own image or annie fn) so each can fade, transition, and be cached independently. Elements that stay constant across segments can be defined once in `effieData.sources` and referenced as `"#name"` from each segment — see the `@effing/effie` README for `#ref` semantics.
- **`fnUrl(kind, id, props, bounds)`** returns a signed URL pointing at another fn's output. The renderer fetches it when it needs the layer's pixels. Always run the dependency's props through `satisfies <DependencyProps>` (here, `satisfies MyAnimationProps`) — typos in prop names then fail the typecheck instead of silently producing a broken URL at runtime.
- **Bounds for child fns can differ from the effie's own bounds.** Useful when an effect needs over-canvas content — e.g. passing `{ width: width * 1.2, height }` to a child annie so it has horizontal slack for a `scroll` effect that pans across.
- **For the full format vocabulary** — layer types, transitions, effects, backgrounds, motion, validation — see `node_modules/@effing/effie/README.md`. This guide only covers the very basics.

The effie is accessible at:

- **Preview:** `/preview/effie/my-video`
- **JSON:** `/effie/{signed-segment}`

## Inspecting an Effing Effie

The preview page lays out the cover and segments visually so you can easily inspect each segment and its layers. For agents working on an effie, there's a parallel JSON endpoint:

```
/preview/effie/:effieId.json?w=1080&h=1920
```

It returns the effie's `effieData` with every layer source already signed, so an agent can follow the URLs into individual annie frames or image stills without scraping the HTML preview or signing its own URL segments. Handy for verifying the output and iterating on a composition without bouncing back to the user for every change.

The preview endpoints render with the fn's `previewProps` and let you set bounds via `?w=` and `?h=` at request time (defaulting to 1080×1080) — useful for inspection without a signing key, though the props are fixed to whatever the file declares. To render with custom props you need a signed URL instead: the `/image/:segment`, `/annie/:segment`, and `/effie/:segment` endpoints encode both props and bounds inside the segment, signed with the project's `SECRET_KEY` so nobody without the key can mint URLs with arbitrary inputs. As a bonus, since the URL fully determines the output, the same signed URL always produces the same bytes — a clean CDN cache key.

## Fonts

`renderReactElement` doesn't ship fonts — pass them via `options.fonts: FontData[]` whenever you render text. `app/fonts.ts` exposes a few Google Fonts ready to import:

```ts
import {
  loadFonts,
  interBold,
  interSemiBold,
  robotoRegular,
  robotoBold,
  openSansRegular,
  openSansSemiBold,
} from "~/fonts";

const fonts = await loadFonts([interBold, robotoRegular]);
```

To add another, copy one of the existing exports in `app/fonts.ts` and point it at the relevant `https://fonts.gstatic.com/s/...ttf` URL. Fonts are fetched at runtime — never bundle them, since that limits your options for where you can run your fns.

The renderer matches the loaded fonts against your CSS by `fontFamily`/`fontWeight`/`fontStyle`. Loading `interBold` (weight 700) but leaving `fontWeight` off your CSS leaves the default weight 400 unmatched — text falls back to a system font. Set the matching `fontWeight` whenever you load a non-default weight.

## Environment variables

```bash
# Required: base URL for the application
BASE_URL=http://localhost:3839
# Required: secret for signing URL segments
SECRET_KEY=your-secret-key

# Optional: FFS rendering service
FFS_BASE_URL=http://localhost:2000
FFS_API_KEY=your-ffs-api-key
```

`npm run dev` starts a local FFS sidecar automatically; the `FFS_*` vars only matter when pointing at a remote FFS server.

## Scripts

| Script                     | What it does                                                                  |
| -------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`              | Runs the app and a local FFS rendering service in parallel.                   |
| `npm run build`            | Builds the app for production.                                                |
| `npm start`                | Starts the production server.                                                 |
| `npm run typecheck`        | Generates React Router types and runs `tsc`.                                  |
| `npm run cloud:deploy`     | Deploys to [Effing Cloud](https://effing.dev) using `effing-cloud.config.ts`. |
| `npm run cloud:url-secret` | Prints the project's URL signing secret from Effing Cloud.                    |

## Deploying

[Effing Cloud](https://effing.dev) is the easiest path: `npm run cloud:deploy` ships the project (configured via `effing-cloud.config.ts`) and everything around running it in production is handled for you. To self-host instead, use the included `Dockerfile` — it builds the app and serves it with `react-router-serve`, but all the rest is up to you.

## Further reading

The `@effing/*` packages each ship a README under `node_modules/@effing/<name>/README.md`. The most useful when working on a fn:

- **`@effing/effie`** — the full Effing Effie format spec (layer types, transitions, effects, source `#refs`, backgrounds, motion, validation).
- **`@effing/canvas`** — the supported CSS subset for `renderReactElement`, plus image and Lottie helpers.
- **`@effing/fn`** — the runner contract and `fnUrl` semantics in detail.
- **`@effing/tween`** — the full list of easing functions and `tween` interval shape.
- **`@effing/annie`** — the TAR frame format if you ever need to consume an annie stream directly.
