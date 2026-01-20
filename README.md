# effing

**Programmatic video built on URLs, but not browsers.**
Animations are simple streams of PNG or JPEG frames. Compositions are declarative typed JSON. Everything is behind a URL. Rendered with just FFmpeg, no browser runtimes. Effing awesome 👌

## Overview

Effing is a modular TypeScript toolkit for programmatic video creation. It introduces three core concepts:

- **Annie** — A streamable animation format (TAR archive of PNG or JPEG frames) that can easily be generated server-side and played in the browser
- **Effie** — A declarative video composition format that describes (in JSON) how to combine animations, images, audio, transitions, and effects into a final video
- **FFS** — An FFmpeg-based rendering service that takes an Effie composition and produces an MP4 video, usable as a library or standalone HTTP server

The “why” and design constraints are described in more detail in [`RATIONALE.md`](RATIONALE.md).

## Packages

| Package                                                     | Description                                         |
| ----------------------------------------------------------- | --------------------------------------------------- |
| [`@effing/create`](packages/create/README.md)               | Scaffold a new Effing project                       |
| [`@effing/effie`](packages/effie/README.md)                 | Types and helpers for defining video compositions   |
| [`@effing/annie`](packages/annie/README.md)                 | Generate TARs of PNG or JPEG frames for animations  |
| [`@effing/ffs`](packages/ffs/README.md)                     | FFmpeg render Service (library or HTTP server)      |
| [`@effing/annie-player`](packages/annie-player/README.md)   | Browser player for Annie animations                 |
| [`@effing/effie-preview`](packages/effie-preview/README.md) | React components for previewing Effie compositions  |
| [`@effing/tween`](packages/tween/README.md)                 | Easing functions and step iteration for animations  |
| [`@effing/satori`](packages/satori/README.md)               | Render JSX to PNG using Satori, with emoji support  |
| [`@effing/serde`](packages/serde/README.md)                 | URL-safe serialization with compression and signing |

## Getting Started

### Prerequisites

Node.js 22+ is required.

### Create a New Project

The quickest way to get started is with `@effing/create`:

```bash
npm create @effing my-effing-app
cd my-effing-app
npm install
npm run dev
```

This scaffolds a complete project with example Annies and Effies. Open [http://localhost:3839](http://localhost:3839) to see it in action.

### Manual Installation

Alternatively, install the packages you need:

```bash
# Core composition types
npm install @effing/effie

# Animation generation
npm install @effing/annie @effing/tween @effing/satori

# Video rendering
npm install @effing/ffs

# Browser playback
npm install @effing/annie-player @effing/effie-preview
```

### Quick Example

**1. Create an Annie animation** (server-side frame generation):

```typescript
import { pngFromSatori } from "@effing/satori";
import { annieStream } from "@effing/annie";
import { tween, easeOutQuad } from "@effing/tween";

async function* generateFrames(width: number, height: number) {
  yield* tween(60, async ({ lower: progress }) => {
    const scale = 1 + 0.5 * easeOutQuad(progress);
    return pngFromSatori(
      <div style={{ transform: `scale(${scale})` }}>Hello!</div>,
      { width, height, fonts: [] }
    );
  });
}

// Stream as TAR archive
const stream = annieStream(generateFrames(1080, 1920));
```

**2. Define an Effie composition**:

```typescript
import { effieData, effieSegment } from "@effing/effie";

const video = effieData({
  width: 1080,
  height: 1920,
  fps: 30,
  cover: "https://example.com/cover.png",
  background: { type: "color", color: "#000000" },
  segments: [
    effieSegment({
      duration: 5,
      layers: [
        { type: "animation", source: "https://example.com/intro.tar" },
        { type: "image", source: "https://example.com/overlay.png", delay: 1 },
      ],
    }),
    effieSegment({
      duration: 4,
      transition: { type: "fade", duration: 0.5 },
      layers: [{ type: "animation", source: "https://example.com/outro.tar" }],
    }),
  ],
});
```

**3. Render to video**:

```typescript
import { EffieRenderer } from "@effing/ffs";

// Use as a library
const renderer = new EffieRenderer(video);
const videoStream = await renderer.render();
// Pipe to file or HTTP response
```

Or run FFS as a standalone server:

```bash
npx @effing/ffs

# First obtain a stream URL
curl -X POST http://localhost:2000/render \
  -H "Content-Type: application/json" \
  -d @composition.json
# Returns: { "id": "...", "url": "http://localhost:2000/render/123e4567-e89b-12d3-a456-426614174000" }

# Then stream the URL to get the video
curl http://localhost:2000/render/123e4567-e89b-12d3-a456-426614174000 -o output.mp4
```

## Demo

The [starter template](demos/starter) is a complete example application showing how to:

- Define reusable Annie animations
- Build Effie compositions from Annies
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

## API Documentation

Full API reference is available at [`docs/api/`](docs/api/README.md).

The API docs are auto-generated from source via a pre-commit hook, so they're always up to date.

## License

O'Saasy
