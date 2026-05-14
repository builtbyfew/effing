# Tutorial

This tutorial walks you through building a video project with [Effing](../README.md). You'll scaffold a new project, explore the example function modules it ships with, make a small change to see how the pieces fit, and render the result to MP4.

If you'd rather learn the fundamentals by building it all up from scratch — using Effing's primitives in plain Node scripts, without the framework — read [Fundamentals](fundamentals.md) first. The two cover different paths to the same destination; either is a fine entry point.

## Prerequisites

- Node.js 22+
- FFmpeg ships bundled via `@effing/ffmpeg` — no system installation needed.

## 1. Scaffold a project

The fastest way to start is `@effing/create`:

```bash
npm create @effing my-app
cd my-app
npm install
cp .env.example .env
```

What you get:

```
my-app/
├── effing.config.ts        # project config: where to find fn modules
├── app/
│   ├── fonts.ts            # helpers for loading fonts
│   ├── images/
│   │   └── simple-slideshow-cover.fn.tsx
│   ├── annies/
│   │   ├── photo-zoom.fn.tsx
│   │   └── text-typewriter.fn.tsx
│   └── effies/
│       └── simple-slideshow.fn.tsx
├── .env                    # BASE_URL, SECRET_KEY, FFS_BASE_URL, FFS_API_KEY
├── Dockerfile
└── package.json
```

Each `*.fn.tsx` is a **function module** — the unit of generation in an Effing project, organized by what it produces (image, annie, or effie). Section 2 walks through the shape of one in detail.

Two environment variables matter from day one:

- `BASE_URL` — the URL the dev/prod server is reachable at (default: `http://localhost:3839`).
- `SECRET_KEY` — used to sign function URLs so the server can verify props haven't been tampered with. Anything random is fine for dev; treat it like a password in production.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3839](http://localhost:3839). The overview page lists every image, annie, and effie in the project with links to their preview pages. `npm run dev` also auto-starts an FFS sidecar in the background, so the "Render it FFS" button on effie previews works out of the box.

## 2. Anatomy of a function module

Every `*.fn.tsx` file is an Effing **function module** — a small unit that turns props into one of three outputs: a single image, a stream of animation frames, or an Effie composition. They all share the same shape.

The simplest of the starter's modules is an image fn. Open `app/images/simple-slideshow-cover.fn.tsx`:

```tsx
import { z } from "zod";
import type { RunnerArgs, ImageRunnerReturn } from "@effing/fn";
import { createCanvas, renderReactElement } from "@effing/canvas";
import { loadFonts, interSemiBold } from "~/fonts";
import { TextTypewriterOverlay } from "~/annies/text-typewriter.fn";

export const propsSchema = z.object({
  imageUrl: z.string().url(),
  text: z.string(),
  fontSize: z.number().int().min(1),
  fontColor: z.string().optional(),
});

export type SimpleSlideshowCoverProps = z.infer<typeof propsSchema>;

export const previewProps: SimpleSlideshowCoverProps = {
  imageUrl: "https://static.effing.dev/picsum/1080/1920/plants.jpg",
  text: "Hello World!",
  fontSize: 64,
};

export async function runner({
  props: { imageUrl, text, fontSize, fontColor = "#ffffff" },
  bounds: { width, height },
}: RunnerArgs<SimpleSlideshowCoverProps>): ImageRunnerReturn {
  const fonts = await loadFonts([interSemiBold]);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await renderReactElement(
    ctx,
    <div
      style={{
        width,
        height,
        display: "flex",
        backgroundImage: `url(${imageUrl})`,
      }}
    >
      <TextTypewriterOverlay
        text={text}
        fontSize={fontSize}
        fontColor={fontColor}
        horizontalAlignment="center"
        verticalAlignment="center"
        cursorShown={false}
      />
    </div>,
    { fonts },
  );
  return canvas.encode("jpeg");
}
```

Three exports, always:

- **`propsSchema`** — a Zod schema. Incoming props are validated against this before the runner sees them; invalid props produce a clean 4xx response.
- **`previewProps`** — defaults the preview UI uses so you can see the fn in action with one click.
- **`runner`** — an async function receiving `{ props, bounds }`. The return type depends on the kind:
  - **image** → `Promise<Buffer>` — PNG or JPEG bytes
  - **annie** → `AsyncIterable<Buffer>` — yields frame buffers; the runtime packages them into a TAR
  - **effie** → `Promise<EffieData>` — a composition that may reference other fn URLs

The `bounds` parameter is the output's dimensions, set by whoever mints the fn URL — typically the preview UI's resolution picker (configurable in `effing.config.ts`) when you're previewing a module on its own, or another fn's `fnUrl(...)` call when one module references another.

Beyond those three exports, a fn module is just a regular module. This one imports `TextTypewriterOverlay` from a sibling annie — function modules can export and reuse code freely.

### The preview page

Click "simple-slideshow-cover" from the overview page. You'll see the rendered image at the chosen resolution. Below it, a **Direct URL** block shows the signed function URL that produces this exact image — copy it and you have a self-contained, parameterized reference. Edit `previewProps` in the file (change the `text`, say) and save: the page reloads, and the Direct URL changes to reflect the new props.

That's the framework's central trick. **A function URL is not a pointer to an image stored somewhere — it _is_ the image, fully parameterized.** The same applies to annies and effies: the props live in the URL itself, signed. The signature is what lets the server execute the runner with confidence the props haven't been tampered with. And since each fn is reachable as a URL, an effie composition can use one wherever it would otherwise reference a static image or animation — the two are interchangeable as far as the renderer is concerned.

Hot reload is wired up: save any `*.fn.tsx` and the preview page refreshes. No restart needed.

## 3. The other starter modules

The same shape, different outputs.

**`app/annies/text-typewriter.fn.tsx`** — an annie. Same module shape as the cover, but `runner` is an `async function*` that yields frame buffers instead of returning a single image. It steps through `@effing/tween` in two phases — typing characters one at a time, then a blinking cursor — yielding one PNG per frame. The runtime packages those frames into a TAR archive (the annie format). The module also exports `TextTypewriterOverlay`, the JSX component the cover fn reuses.

**`app/annies/photo-zoom.fn.tsx`** — another annie. Fetches an image from a URL, cover-crops it to the target aspect ratio, and zooms toward the center over `frameCount` frames. Uses `loadImage` plus `ctx.drawImage` for the zoom — no JSX, because pixel-level control is more direct here. A reminder that runners can render however they like, as long as the bytes they yield are PNG or JPEG.

**`app/effies/simple-slideshow.fn.tsx`** — the effie that composes everything. Its runner returns an `EffieData` object whose layer sources are built with `fnUrl()`:

```tsx
import { fnUrl } from "@effing/fn";

const animationUrl = await fnUrl(
  "annie",
  "photo-zoom",
  { imageUrl, frameCount, zoomLevel } satisfies PhotoZoomProps,
  { width: width * 1.2, height },
);
```

`fnUrl` mints a signed URL for the named fn with the given props and bounds. Plug that URL into a `source` field of a layer, and the renderer resolves it the same way as any external `https://` URL — whether the bytes come from a static CDN or another fn makes no difference to FFS.

## 4. Make a small change

Let's prove the loop works end to end. Open `app/effies/simple-slideshow.fn.tsx` and add a fourth slide to `previewProps`:

```ts
export const previewProps: SimpleSlideshowProps = {
  slides: [
    // ...the three existing slides...
    {
      text: "Try this slide 🎉",
      imageUrl: "https://static.effing.dev/picsum/1080/1920/sea.jpg",
      duration: 4,
    },
  ],
};
```

Save. The preview page reloads, and the slideshow now has four segments instead of three. Click **Render it FFS** to produce an MP4. The button is wired to the FFS sidecar that `npm run dev` started; the video streams back into the preview where the cover was, and a **Download video** link appears once it's fully buffered.

You've now edited a fn, watched the preview pick up the change, and rendered the result. That's the whole loop.

## 5. Rendering via FFS over HTTP

"Render it FFS" runs a short HTTP choreography under the hood. You can reproduce it from the command line.

First, mint a signed URL for the slideshow with whatever props you want — the project includes a small CLI for this:

```bash
npm run url effie simple-slideshow \
  --props '{"slides":[...]}' \
  --width 1080 --height 1920
# Prints a signed URL like:
# http://localhost:3839/effie/<signed-segment>
# where <signed-segment> is the id, props, and bounds encoded together
# and HMAC-signed with SECRET_KEY.
```

Then drive FFS through its HTTP API:

```bash
# 1. Create a render job. FFS will fetch the effie URL during warmup.
curl -X POST http://localhost:2000/render \
  -H "Content-Type: application/json" \
  -d '{"effie": "http://localhost:3839/effie/<signed-segment>"}'
# → { "id": "...", "progressUrl": "http://localhost:2000/render/.../progress" }

# 2. Connect to the SSE progress stream (effie → warmup → render → ready).
curl http://localhost:2000/render/.../progress

# 3. Fetch the rendered video. The SSE stream's `ready` event delivers this URL
#    as { "videoUrl": "http://localhost:2000/render/.../video" }.
curl http://localhost:2000/render/.../video -o slideshow.mp4
```

The full HTTP surface — warmup-only jobs, cache purging, S3 upload mode, backend resolvers for splitting warmup and render across services — is documented in [`@effing/ffs`'s README](../packages/ffs/README.md).

For a one-off render without a long-running server, FFS also has a CLI, by the way:

```bash
npx @effing/ffs render <effie-url-or-json-file> output.mp4
```

## 6. Build and deploy

There are two paths to production.

**[Effing Cloud](https://effing.dev)** is the easiest. Run `npm run cloud:deploy` and the project (configured via `effing.config.ts`) ships to managed infrastructure that handles everything for you.

**Self-host** uses `effing build`, which bundles a production HTTP server with every fn module statically imported into `dist/server.js`:

```bash
npm run build                                  # produces dist/server.js
BASE_URL=https://yourapp SECRET_KEY=... \
  FFS_BASE_URL=https://your-ffs FFS_API_KEY=... \
  node dist/server.js
```

The included `Dockerfile` invokes the same build inside the container, so you can `docker build` and ship the image to any platform that runs containers.

In dev, `npm run dev` auto-started an FFS sidecar for you. In production you'll need to provide that FFS instance yourself, since `effing build` and the Dockerfile cover the **fns** only. Run `@effing/ffs` yourself somewhere and point `FFS_BASE_URL` at it, or use Effing Cloud's managed FFS, even when your fns are self-hosted.

## 7. Working with coding agents

Coding agents (Claude Code, Codex, Cursor, etc.) work well with Effing by design. Fn modules are small, typed, and schema-validated; and each previews in isolation — properties that translate directly to fast feedback for an agent.

At the composition layer, effies serialize to JSON, so an agent can fetch one and inspect the high-level structure directly. Layer sources are URLs it can follow to drill into individual images or animations as needed — a natural form of progressive disclosure.

A useful trick here is to tell your agent to RTFM. The starter's `AGENTS.md` nudges agents to run and read `effing manual` — a focused reference of fn-module patterns, `fnUrl` semantics, and conventions — before touching fn modules.

## Where to go next

- **[Fundamentals](fundamentals.md)** — the same building blocks without the framework, in plain Node scripts. Useful for fully grasping the basics.
- **Package READMEs** for depth — [`@effing/fn`](../packages/fn/README.md), [`@effing/dev`](../packages/dev/README.md), [`@effing/ffs`](../packages/ffs/README.md), [`@effing/canvas`](../packages/canvas/README.md), [`@effing/tween`](../packages/tween/README.md), [`@effing/annie`](../packages/annie/README.md), [`@effing/effie`](../packages/effie/README.md).
- **[API docs](api/README.md)** — full reference, auto-generated from source.

A few directions worth exploring once you're comfortable:

- **Write a new fn.** Copy one of the starter modules into `app/{images,annies,effies}/` under a new name. The dev server picks it up automatically.
- **Parameterize for a real product.** Hook an effie's props to whatever lives in your data — a user profile, a campaign payload, a CMS record — and you have on-demand video generation. Each unique props payload is a unique URL, which a CDN can cache.
- **Run multiple resolutions.** Add or change entries in `dev.resolutions` in `effing.config.ts` to preview at the aspect ratios your platform actually needs.
