# @effing/annie

**Generate TAR archives of PNG or JPEG frames for animated layers.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Annie is a simple animation format: a TAR archive containing sequentially-named PNG or JPEG frames. Generate frames server-side, stream them to the browser or FFmpeg.

## Installation

```bash
npm install @effing/annie
```

## Concepts

### Annie Format

An Annie is a TAR archive where each entry is a PNG or JPEG frame:

```
frame_00000
frame_00001
frame_00002
...
```

This format is:

- **Streamable** — frames can be written as they're generated
- **Universal** — TAR is supported everywhere
- **FFmpeg-compatible** — can be piped directly to FFmpeg as image input

### Generation Patterns

Annie supports two generation patterns:

**Buffer** — Collect all frames, return complete archive:

```typescript
const archive = await annieBuffer(frames);
```

**Stream** — Yield chunks as frames are generated:

```typescript
const stream = annieStream(frames);
```

## Quick Start

```typescript
import { annieStream, annieBuffer } from "@effing/annie";
import { pngFromSatori } from "@effing/satori";
import { tween, easeOutQuad } from "@effing/tween";

// Define a frame generator
async function* generateFrames() {
  yield* tween(90, async ({ lower: progress }) => {
    const scale = 1 + 0.3 * easeOutQuad(progress);
    return pngFromSatori(
      <div style={{
        width: 1080,
        height: 1920,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 72,
        transform: `scale(${scale})`
      }}>
        Hello World!
      </div>,
      { width: 1080, height: 1920, fonts: myFonts }
    );
  });
}

// Stream response
const stream = annieStream(generateFrames(), { signal: request.signal });
return new Response(stream, {
  headers: { "Content-Type": "application/x-tar" }
});
```

## API Overview

### Functions

#### `annieStream(frames, options?)`

Create a `ReadableStream` that produces TAR chunks as frames are generated.

```typescript
function annieStream(
  frames: AsyncIterable<Buffer>,
  options?: AnnieStreamOptions,
): ReadableStream<Buffer>;
```

**Options:**

- `signal` — AbortSignal for cancellation

#### `annieBuffer(frames)`

Collect all frames and return a complete TAR buffer.

```typescript
function annieBuffer(frames: AsyncIterable<Buffer>): Promise<Buffer>;
```

### Response Helper

#### `annieResponse(frames, options?)`

Create a complete `Response` object with proper headers.

```typescript
import { annieResponse } from "@effing/annie";

return annieResponse(generateFrames(), {
  signal: request.signal,
  headers: { "Cache-Control": "public, max-age=3600" },
});
```

## Examples

### With Express/Node.js

```typescript
import { Readable } from "stream";
import { annieStream } from "@effing/annie";

app.get("/animation.tar", async (req, res) => {
  const stream = annieStream(generateFrames());
  res.setHeader("Content-Type", "application/x-tar");
  Readable.fromWeb(stream).pipe(res);
});
```

### With React Router / Remix

```typescript
import { annieResponse } from "@effing/annie";

export async function loader({ request }: LoaderFunctionArgs) {
  return annieResponse(generateFrames(), { signal: request.signal });
}
```

### Saving to File

```typescript
import { writeFile } from "fs/promises";
import { annieBuffer } from "@effing/annie";

const buffer = await annieBuffer(generateFrames());
await writeFile("animation.tar", buffer);
```

### FFmpeg Integration

Note that Annie TAR archives can be piped directly to FFmpeg. Extract the frames with `tar -xO` and pipe to FFmpeg's image2pipe input:

```bash
# Create animated PNG (loops forever)
tar -xO < animation.tar | ffmpeg -f image2pipe -framerate 30 -i - -plays 0 -c:v apng -f apng output.png

# Create MP4 video
tar -xO < animation.tar | ffmpeg -f image2pipe -framerate 30 -i - -c:v libx264 -pix_fmt yuv420p output.mp4

# Create GIF
tar -xO < animation.tar | ffmpeg -f image2pipe -framerate 30 -i - output.gif
```

## Related Packages

- [`@effing/tween`](../tween) — Step iteration and easing functions for frame generation
- [`@effing/satori`](../satori) — Render JSX to PNG for each frame
- [`@effing/annie-player`](../annie-player) — Play Annies in the browser
- [`@effing/effie`](../effie) — Use Annies as layers in video compositions
