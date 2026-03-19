# Effing Design Rationale

Effing came to life because we wanted programmatic video creation without headless browsers, SaaS lock-in, or clunky integration into modern web architectures. The result: a modular toolkit of TypeScript packages that basically only need Node.js and FFmpeg to run.

## The core idea

Effing is a collection of small packages with simple functions. Use what you need, in any environment, with any framework.

Three guiding principles:

- **Modularity over monoliths.** Pick the packages you need. They work independently.
- **Simplicity over magic.** Plain data, pure functions, standard formats. No hidden state.
- **No vendor lock-in.** Run the whole pipeline yourself if you want to.

## How it works

Effing splits video creation into three independent layers:

1. **Annie** — Generate animation frames (async generators → PNG or JPEG buffers → TAR archives)
2. **Effie** — Describe video compositions (typed JSON: segments, layers, transitions, effects, motion)
3. **FFS** — Render to video (FFmpeg orchestration → MP4 stream)

Each layer has a single job and a clear contract. Annie doesn't know about Effie. Effie doesn't know about FFmpeg. Problems stay local to their domain.

## Key design decisions

### Compositions are data, not code

An Effie composition is plain JSON. Not a component tree, not imperative code, not a timeline you scrub:

```ts
const video = effieData({
  width: 1080,
  height: 1920,
  fps: 30,
  cover: "https://example.com/cover.png",
  background: { type: "color", color: "black" },
  segments: [
    { duration: 5, layers: [{ type: "animation", source: "https://..." }] },
    { duration: 4, layers: [...], transition: { type: "fade", duration: 0.5 } },
  ],
});
```

You can log it, diff it, serialize it to storage, generate it programmatically, send it over the wire, you name it.

### Strong typing without ceremony

Helper functions provide full TypeScript inference for your Effies:

```ts
const video = effieData({
  width: 1080,
  height: 1920,
  fps: 30,
  cover: "https://example.com/cover.png",
  background: { type: "color", color: "black" },
  // ... everything is fully typed from here down
});
```

You get autocomplete, type errors, and inline documentation without decorators, schemas, or config files.

### URLs all the way down

Every source (animations, images, audio, video backgrounds) is represented as a URL:

```ts
layers: [
  { type: "animation", source: "https://example.com/intro.tar" },
  { type: "image", source: "https://example.com/overlay.png" },
];
```

This makes rendering stateless and reproducible. And more importantly: you get HTTP's entire ecosystem for free.

Props can live inside URLs too. E.g. an Annie like `photo-zoom` becomes a URL:

```ts
const source = await annieUrl({
  annieId: "photo-zoom",
  props: { imageUrl: "https://...", zoomLevel: 0.2 },
  width: 1080,
  height: 1920,
});
// → "https://your.app/an/eJxLtDK0MrYyNzE2sQIAC7IB4Q?w=1080&h=1920"
```

The props get serialized into a (compressed and signed) URL-safe segment. Same inputs, same URL. This turns Annies into reusable components that are basically just URLs, so caching and deduplication come naturally. If two videos use the same animation with the same parameters, you only generate it once.

Standard tools (curl, browsers, caching proxies) also just work. You're building on HTTP, not inventing custom protocols.

### Just generate images

Annie animations are async generators that yield PNG or JPEG buffers:

```ts
async function* generateFrames() {
  yield* tween(60, async ({ lower: progress }) => {
    return somePngBuffer; // however you produce it
  });
}
```

No browser in the rendering loop. No framework lifecycle. No headless Puppeteer screenshots. You just generate images, using canvas directly, our JSX-to-canvas rendering, sharp for image manipulation, or whatever you want.

This makes animations trivially testable (call the generator, collect frames, assert on pixels), composable (splice generators together), and framework-independent.

### Inspectable intermediates

Animation archives are TAR files containing numbered PNG/JPEG frames:

```
frame_00000
frame_00001
frame_00002
...
```

You can inspect them with standard Unix tools (`tar -tf`, extract individual frames, view in any image viewer) or pipe them directly into FFmpeg for generating GIFs, APNGs, or videos.

Why TAR over ZIP? ZIP stores its file index at the end, so you need the whole archive before you can read anything. TAR streams: each file's header comes right before its contents, so frames can be written and read one at a time without buffering the entire animation.

### Streaming by default

Frames stream out as they're generated. Renders stream as they run, either the MP4 bytes directly or SSE progress events. Nothing waits for the whole thing to finish.

This keeps memory bounded, avoids CDN timeouts (Cloudflare has a 100s timeout for instance), and lets you cancel mid-stream.

### Built-in partitioning

Split compositions for distributed rendering and join them back:

```ts
// Render each segment on a different machine
const segmentEffie = effieDataForSegment(video, segmentIndex);

// Join the results
const joinEffie = effieDataForJoin(video, renderedSegmentUrls);
```

The URL-based architecture means segments can be rendered anywhere and assembled later.

## What Effing deliberately avoids

**Browser-based rendering.** Some tools screenshot React components in a headless browser. This adds complexity and the entire browser runtime. Effing generates images directly. No browser required.

**Framework coupling.** Effing is plain TypeScript functions. No specific web framework required, no runtime dependencies beyond Node.js and FFmpeg. Use it in Express, Fastify, Next.js, or a plain script.

**SaaS dependency.** You can run the entire pipeline on your own infrastructure if you want to. It's all open source, no vendor lock-in.

**Visual editors.** There's no timeline to drag clips around on. Effing is for people who want to write code. If you need a visual editor, this isn't the right tool.

## Works well with AI

No framework magic to get wrong. AI can generate Effie compositions and Annie animations using standard patterns—and you can diff the results.

## Real trade-offs

**Not chasing every feature.** We don't expose every FFmpeg capability. If you need custom x264 parameters or arbitrary filter graphs, you'll outgrow the abstraction.

**No zero-latency previews.** Generating real PNG/JPEG frames is slower than a dedicated preview renderer. What you preview is exactly what you render though. Accuracy over speed.

The goal is a small, correct, understandable system for turning code into useful videos. Not everything to everyone.
