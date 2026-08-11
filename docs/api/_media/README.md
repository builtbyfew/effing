# effing

**Programmatic images and videos built on web standards, without browsers.**
Generate images with a server-side canvas that renders JSX and flexbox to pixels — no DOM, no headless Chrome. Compose videos as declarative JSON with typed transitions, effects, and audio. Serve everything as parameterized URLs: images, animations, entire video compositions. Video rendering is just FFmpeg.

## Overview

Effing is a modular TypeScript toolkit. It splits image and video creation into four independent pieces:

- **Image** — A single PNG or JPEG, generated with canvas drawing, JSX-to-canvas, or anything else that produces image bytes
- **Annie** — A streamable animation format (TAR archive of PNG or JPEG frames) that can be generated server-side and played in the browser
- **Effie** — A declarative composition format that describes (in JSON) how to combine images, annies, audio, transitions, and effects into a final video
- **FFS** — An FFmpeg-based rendering service that takes an Effie composition and produces an MP4 video, usable as a library or standalone HTTP server

The “why” and design constraints are described in more detail in [`RATIONALE.md`](RATIONALE.md).

## Demo

> [!TIP]
> For a step-by-step walkthrough, see the [Tutorial](docs/tutorial.md).

The [starter template](demos/starter) is a complete example application showing how to:

- Define reusable image and annie generators
- Build effie compositions that reference them by URL
- Preview compositions in the browser
- Render final videos

Create your own project based on the starter:

```bash
npm create @effing my-effing-app
```

Or run the demo directly from this repo:

```bash
cd demos/starter
pnpm install
pnpm dev
```

Then open [http://localhost:3839](http://localhost:3839).

## Examples

More worked examples live in the [effing-examples](https://github.com/builtbyfew/effing-examples) repo.

## Packages

| Package                                                     | Description                                         |
| ----------------------------------------------------------- | --------------------------------------------------- |
| [`@effing/create`](packages/create/README.md)               | Scaffold a new Effing project                       |
| [`@effing/dev`](packages/dev/README.md)                     | Dev server and build tooling for Effing projects    |
| [`@effing/effie`](packages/effie/README.md)                 | Types and helpers for defining video compositions   |
| [`@effing/annie`](packages/annie/README.md)                 | Generate TARs of PNG or JPEG frames for animations  |
| [`@effing/ffs`](packages/ffs/README.md)                     | FFmpeg render Service (library or HTTP server)      |
| [`@effing/ffmpeg`](packages/ffmpeg/README.md)               | Self-managed FFmpeg binary download                 |
| [`@effing/annie-player`](packages/annie-player/README.md)   | Browser player for Annie animations                 |
| [`@effing/effie-preview`](packages/effie-preview/README.md) | React components for previewing Effie compositions  |
| [`@effing/tween`](packages/tween/README.md)                 | Easing functions and step iteration for animations  |
| [`@effing/canvas`](packages/canvas/README.md)               | Server-side canvas with JSX and Lottie support      |
| [`@effing/fn`](packages/fn/README.md)                       | Pluggable module loading and URL building           |
| [`@effing/serde`](packages/serde/README.md)                 | URL-safe serialization with compression and signing |

## API Documentation

Full API reference is available at [`docs/api/`](docs/api/README.md).

## License

[MIT](LICENSE)
