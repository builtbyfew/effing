# Effing Design Rationale

Effing came to life because we wanted programmatic image and video creation without headless browsers, SaaS lock-in, or clunky integration into modern web architectures. The result: a modular toolkit of TypeScript packages that basically only need Node.js and FFmpeg to run.

## The core idea

Effing is a collection of small packages with simple functions. Use what you need, in any environment, with any framework.

Three guiding principles:

- **Modularity over monoliths.** Pick the packages you need. They work independently.
- **Simplicity over magic.** Plain data, pure functions, standard formats. No hidden state.
- **No vendor lock-in.** Run the whole pipeline yourself if you want to.

## How it works

Effing splits image and video creation into four independent pieces:

1. **Image** — A single PNG or JPEG, generated however you like — canvas drawing, JSX-to-canvas, or anything that produces image bytes.
2. **Annie** — A streamable animation format: a TAR archive of sequentially-named PNG or JPEG frames. Frames come from the same generation primitives, packaged for streaming.
3. **Effie** — A declarative composition format: typed JSON describing segments, layers, transitions, effects, motion, and audio. Layers reference content by URL — images, annies, audio, video backgrounds.
4. **FFS** — An FFmpeg-based rendering service that turns an Effie into an MP4. Library, CLI, or HTTP server.

Each piece has a single job and a clear contract. Images and annies don't know about effies. Effies don't know about FFmpeg. Problems stay local to their domain.

## Key design decisions

### Compositions in JSON

An Effie is plain JSON. You can log it, diff it, serialize it to storage, generate it programmatically, send it over the wire, you name it.

Helper functions provide full TypeScript inference for compositions authored in code — autocomplete, type errors, and inline documentation.

### URLs all the way down

Every source — animation, image, audio, video — is referenced by URL. This makes rendering stateless and reproducible, and gives you HTTP's entire ecosystem for free: caching, CDNs, standard tooling.

Props can live inside URLs too. The props for any generated content — image, animation, or whole composition — get serialized into a compressed, signed URL-safe segment, so that the function's parameterized output _is_ a URL. Same inputs, same URL — caching and deduplication come for free. Two videos referencing the same generated image or animation only produce it once.

### Just generate images

There's no special rendering engine. No browser in the rendering loop, no headless Puppeteer screenshots.

This makes both single-shot image generation and frame-by-frame animation generation easily testable (call the function, assert on the pixels), composable, and framework-independent.

### Inspectable intermediates

Animation archives are TAR files of numbered PNG or JPEG frames. Inspect them with standard Unix tools, extract individual frames, view them in any image viewer, or pipe them straight into FFmpeg for generating GIFs, APNGs, or videos.

TAR over ZIP because TAR streams: the headers sit before the contents, so frames can be written and read one at a time without buffering the whole archive.

### Streaming by default

Frames stream out as they're generated. Renders stream as they run — either the MP4 bytes directly or SSE progress events. Nothing waits for the whole thing to finish, so memory stays bounded, CDN timeouts (Cloudflare's 100s limit, for instance) are avoided, and you can cancel mid-stream.

### Built-in partitioning

Compositions can be split for distributed rendering and joined back. The URL-based architecture means segments can be rendered anywhere and assembled later.

## What Effing deliberately avoids

**Browser-based rendering.** Some tools screenshot React components in a headless browser. This adds complexity and an entire browser runtime. Effing generates images directly. No browser required.

**Framework coupling.** Effing is plain TypeScript functions. No specific web framework required, no runtime dependencies beyond Node.js and FFmpeg. Use it in Express, Fastify, Next.js, or a plain script.

**SaaS dependency.** Run the entire pipeline on your own infrastructure if you want to. It's all open source.

**Visual editors.** There's no timeline to drag clips around on. Effing is for people who want to write code. If you need a visual editor, this isn't the right tool.

## Designed for coding agents

The same properties that make Effing easy to reason about make it well-suited to coding agents: small modules with strong types and schema-validated props, and inspectable JSON compositions. Agents can iterate on one module at a time and walk an effie's JSON to debug a composition.

## Real trade-offs

**Not chasing every feature.** We don't expose every FFmpeg capability. If you need custom x264 parameters or arbitrary filter graphs, you'll outgrow the abstraction.

**No zero-latency previews.** Generating real PNG/JPEG frames is slower than a dedicated preview renderer. What you preview is exactly what you render though. Accuracy over speed.

The goal is a small, correct, understandable system for turning code into useful images and videos. Not everything to everyone.
