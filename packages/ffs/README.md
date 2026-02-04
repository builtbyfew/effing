# @effing/ffs

**FFmpeg-based video renderer for Effie compositions.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Takes an `EffieData` composition and renders it to an MP4 video using FFmpeg. Use as a library or run as a standalone HTTP server.

## Installation

```bash
npm install @effing/ffs
```

FFmpeg is bundled via `ffmpeg-static` — no system installation required.

## Quick Start

### As a Library

```typescript
import { EffieRenderer } from "@effing/ffs";

const renderer = new EffieRenderer(effieData);
const videoStream = await renderer.render();

// Pipe to file
videoStream.pipe(fs.createWriteStream("output.mp4"));

// Or pipe to HTTP response
videoStream.pipe(res);

// Clean up when done
renderer.close();
```

### As an HTTP Server

```bash
# Run the server
npx @effing/ffs

# Or with custom port
FFS_PORT=8080 npx @effing/ffs
```

Rendering is a two-step process with the HTTP server: first obtain a stream URL, then stream that URL to get the video.

```bash
# 1. Obtain a stream URL
curl -X POST http://localhost:2000/render \
  -H "Content-Type: application/json" \
  -d @composition.json
# Returns: { "id": "...", "url": "http://localhost:2000/render/123e4567-e89b-12d3-a456-426614174000" }

# 2. Stream the URL to get the video
curl http://localhost:2000/render/123e4567-e89b-12d3-a456-426614174000 -o output.mp4
```

The server uses an internal HTTP proxy for video/audio URLs to ensure reliable DNS resolution in containerized environments (e.g., Alpine Linux). This is why you might see another server running on a random port.

#### Environment Variables

| Variable                         | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `FFS_PORT`                       | Server port (default: 2000)                          |
| `FFS_BASE_URL`                   | Base URL for returned URLs                           |
| `FFS_API_KEY`                    | API key for authentication (optional)                |
| `FFS_TRANSIENT_STORE_BUCKET`     | S3 bucket for transient store (enables S3 mode)      |
| `FFS_TRANSIENT_STORE_ENDPOINT`   | S3-compatible endpoint (for e.g. R2 or MinIO)        |
| `FFS_TRANSIENT_STORE_REGION`     | AWS region (default: "auto")                         |
| `FFS_TRANSIENT_STORE_PREFIX`     | Key prefix for stored objects                        |
| `FFS_TRANSIENT_STORE_ACCESS_KEY` | S3 access key ID                                     |
| `FFS_TRANSIENT_STORE_SECRET_KEY` | S3 secret access key                                 |
| `FFS_TRANSIENT_STORE_LOCAL_DIR`  | Local storage directory (when not using S3)          |
| `FFS_SOURCE_CACHE_TTL_MS`        | TTL for cached sources in ms (default: 60 min)       |
| `FFS_JOB_METADATA_TTL_MS`        | TTL for job metadata in ms (default: 8 hours)        |
| `FFS_WARMUP_CONCURRENCY`         | Concurrent source fetches during warmup (default: 4) |
| `FFS_WARMUP_BACKEND_BASE_URL`    | Separate backend for warmup (see Backend Separation) |
| `FFS_RENDER_BACKEND_BASE_URL`    | Separate backend for render (see Backend Separation) |

When `FFS_TRANSIENT_STORE_BUCKET` is not set, FFS uses the local filesystem for storage (default: system temp directory). Local files are automatically cleaned up after the TTL expires.

For S3 storage, the TTL is set as the `Expires` header on objects. Note that this is metadata only. To enable automatic deletion, configure [S3 lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) on your bucket to delete expired objects.

## Concepts

### EffieRenderer

The main class that orchestrates video rendering:

1. **Builds FFmpeg command** — Constructs complex filter graphs for overlays, transitions, effects
2. **Fetches sources** — Downloads images, animations, and audio from URLs
3. **Processes layers** — Applies motion, effects, and timing to each layer
4. **Outputs video** — Streams H.264/AAC MP4 to stdout or file

## API Overview

### EffieRenderer

```typescript
class EffieRenderer {
  constructor(effieData: EffieData<EffieSources>);

  // Render composition
  render(scaleFactor?: number): Promise<Readable>;

  // Clean up FFmpeg process
  close(): void;
}
```

### FFmpegCommand & FFmpegRunner

Lower-level classes for building and executing FFmpeg commands:

```typescript
import { FFmpegCommand, FFmpegRunner } from "@effing/ffs";

const cmd = new FFmpegCommand(globalArgs, inputs, filterComplex, outputArgs);
const runner = new FFmpegRunner(cmd);
const output = await runner.run(fetchSource, transformImage);
```

### Processing Functions

```typescript
import { processMotion, processEffects, processTransition } from "@effing/ffs";

// Convert motion config to FFmpeg overlay expression
const overlayExpr = processMotion(delay, motionConfig);

// Build effect filter chain
const filters = processEffects(effects, fps, width, height);

// Get FFmpeg transition name
const xfadeName = processTransition(transition);
```

## Server Endpoints

When running as an HTTP server, FFS provides endpoints for rendering, cache warmup, and cache purging.

### `POST /render`

Creates a render job and returns a stream URL to execute it. Supports two request formats:

**Raw EffieData**: Body is raw EffieData, options in query params.

| Query Param | Effect                    |
| ----------- | ------------------------- |
| `scale`     | Scale factor (default: 1) |

**Wrapped format**: Body contains `effie` plus options.

```typescript
type RenderOptions = {
  effie: EffieData | string; // EffieData object or URL to fetch from
  scale?: number; // Scale factor (default: 1)
  upload?: {
    videoUrl: string; // Pre-signed URL to upload rendered video
    coverUrl?: string; // Pre-signed URL to upload cover image
  };
};
```

| Option         | Effect                                         |
| -------------- | ---------------------------------------------- |
| `effie` as URL | Fetches EffieData from the URL before storing  |
| `upload`       | GET will upload and stream SSE progress events |

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "http://localhost:2000/render/550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /render/:id`

Executes the render job. Behavior depends on whether `upload` was specified:

**Without upload** — Streams the MP4 video directly:

```bash
curl http://localhost:2000/render/550e8400-... -o output.mp4
```

**With upload** — Streams progress via Server-Sent Events (SSE) while uploading:

| Event       | Data                                                       |
| ----------- | ---------------------------------------------------------- |
| `started`   | `{ "status": "rendering" }`                                |
| `keepalive` | `{ "status": "rendering" }` or `{ "status": "uploading" }` |
| `complete`  | `{ "status": "uploaded", "timings": {...} }`               |
| `error`     | `{ "message": "..." }`                                     |

**Example:**

```typescript
// Create render job
const { url } = await fetch("/render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData, scale: 0.5 }),
}).then((r) => r.json());

// Stream video directly
const videoResponse = await fetch(url);
const videoBlob = await videoResponse.blob();
```

### `POST /warmup`

Creates a warmup job for pre-fetching and caching the sources from an Effie composition. Use this to avoid render timeouts when sources (especially annies) take a long time to generate.

**Request:** Same format as `/render` (raw or wrapped EffieData with `effie` field).

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "http://localhost:2000/warmup/550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /warmup/:id`

Runs the cache warmup job and streams the progress via Server-Sent Events (SSE). Connect with `EventSource` for real-time updates.

**Events:**

| Event         | Data                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| `start`       | `{ "total": 5 }`                                                                             |
| `progress`    | `{ "url": "...", "status": "hit"\|"cached"\|"error", "cached": 2, "failed": 0, "total": 5 }` |
| `downloading` | `{ "url": "...", "status": "downloading", "bytesReceived": 1048576 }`                        |
| `keepalive`   | `{ "cached": 2, "failed": 0, "total": 5 }`                                                   |
| `summary`     | `{ "cached": 5, "failed": 0, "total": 5 }`                                                   |
| `complete`    | `{ "status": "ready" }`                                                                      |

**Example:**

```typescript
// Create warmup job
const { url } = await fetch("/warmup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData }),
}).then((r) => r.json());

// Stream progress (url is a full URL)
const events = new EventSource(url);
events.addEventListener("complete", () => {
  events.close();
  // Now safe to call /render
});
```

### `POST /purge`

Purges cached sources for a given Effie composition.

**Request:** Same format as `/render` (raw or wrapped EffieData with `effie` field).

**Response:**

```json
{ "purged": 3, "total": 5 }
```

### `POST /warmup-and-render`

Creates a combined warmup and render job that runs both phases in a single SSE stream. This is useful when you want to warmup sources and render in one request.

**Request:**

```typescript
type WarmupAndRenderOptions = {
  effie: EffieData | string; // EffieData object or URL to fetch from
  scale?: number; // Scale factor (default: 1)
  upload?: {
    videoUrl: string; // Pre-signed URL to upload rendered video
    coverUrl?: string; // Pre-signed URL to upload cover image
  };
};
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "http://localhost:2000/warmup-and-render/550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /warmup-and-render/:id`

Executes the combined warmup and render job, streaming progress via SSE. All events are prefixed with `warmup:` or `render:` to indicate the phase.

**Events:**

| Event                | Phase  | Data                                                              |
| -------------------- | ------ | ----------------------------------------------------------------- |
| `warmup:start`       | warmup | `{ "total": 5 }`                                                  |
| `warmup:progress`    | warmup | `{ "url": "...", "status": "hit"\|"cached"\|"error", ... }`       |
| `warmup:downloading` | warmup | `{ "url": "...", "status": "downloading", "bytesReceived": ... }` |
| `warmup:summary`     | warmup | `{ "cached": 5, "failed": 0, "skipped": 0, "total": 5 }`          |
| `warmup:complete`    | warmup | `{ "status": "ready" }`                                           |
| `render:started`     | render | `{ "status": "rendering" }`                                       |
| `keepalive`          | both   | `{ "phase": "warmup" }` or `{ "phase": "render" }`                |
| `render:complete`    | render | `{ "status": "uploaded", "timings": {...} }` (upload mode)        |
| `complete`           | -      | `{ "status": "ready", "videoUrl": "..." }` (non-upload mode)      |
| `error`              | any    | `{ "phase": "warmup"\|"render", "message": "..." }`               |

**Without upload** — Returns a `videoUrl` pointing to `/render/:id` for streaming:

```typescript
const events = new EventSource(url);
events.addEventListener("complete", (e) => {
  const { videoUrl } = JSON.parse(e.data);
  // Fetch videoUrl to stream the rendered video
  events.close();
});
```

**With upload** — Uploads directly and streams progress:

```typescript
const events = new EventSource(url);
events.addEventListener("render:complete", (e) => {
  const { timings } = JSON.parse(e.data);
  console.log("Uploaded!", timings);
  events.close();
});
```

## Backend Separation

FFS supports running warmup and render on separate backends, useful for scaling or resource isolation. When backend URLs are configured, the cache storage must be shared between services (e.g., using S3).

**Environment variables:**

- `FFS_WARMUP_BACKEND_BASE_URL` — Base URL for warmup backend (e.g., `https://warmup.your.app`)
- `FFS_RENDER_BACKEND_BASE_URL` — Base URL for render backend (e.g., `https://render.your.app`)

**Behavior when set:**

| Endpoint                     | Effect                                               |
| ---------------------------- | ---------------------------------------------------- |
| `POST /warmup`               | Returns URL pointing to local server (orchestrator)  |
| `GET /warmup/:id`            | Proxies SSE from warmup backend                      |
| `POST /render`               | Returns URL pointing to local server (orchestrator)  |
| `GET /render/:id`            | Proxies from render backend (SSE or video stream)    |
| `POST /warmup-and-render`    | Returns URL pointing to local server (orchestrator)  |
| `GET /warmup-and-render/:id` | Proxies SSE from warmup backend, then render backend |

All GET endpoints proxy requests to the configured backend, keeping backend URLs hidden from clients. This ensures compatibility with EventSource (which doesn't follow redirects) and simplifies CORS configuration since only the orchestrator needs to be publicly accessible.

## Examples

### Scale Factor for Previews

Render at reduced resolution for faster previews:

```typescript
const renderer = new EffieRenderer(video);

// Render at 50% resolution
const previewStream = await renderer.render(0.5);
```

### Distributed Rendering

For videos with many segments, you can render in parallel using the partitioning helpers from `@effing/effie`:

```typescript
import { EffieRenderer } from "@effing/ffs";
import { effieDataForSegment, effieDataForJoin } from "@effing/effie";

const effieData = /* ... */;

// 1. Render each segment (can be parallelized across workers/servers)
const segmentUrls = await Promise.all(
  effieData.segments.map(async (_, i) => {
    const segEffie = effieDataForSegment(effieData, i);
    const renderer = new EffieRenderer(segEffie);
    const stream = await renderer.render();
    // Upload to storage and get URL
    const url = await uploadToStorage(stream, `segment_${i}.mp4`);
    renderer.close();
    return url;
  })
);

// 2. Join segments with transitions and global audio
const joinEffie = effieDataForJoin(effieData, segmentUrls);
const joinRenderer = new EffieRenderer(joinEffie);
const finalStream = await joinRenderer.render();
```

### Server API Examples

**Create render job and stream video:**

```typescript
// Create render job
const { url } = await fetch("http://localhost:2000/render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData, scale: 0.5 }),
}).then((r) => r.json());

// Stream the video
const video = await fetch(url).then((r) => r.blob());
```

**Fetch from URL and render:**

```typescript
const { url } = await fetch("http://localhost:2000/render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    effie: "https://example.com/composition.json",
    scale: 0.5,
  }),
}).then((r) => r.json());
```

**Render and upload to S3 (SSE progress):**

```typescript
const { url } = await fetch("http://localhost:2000/render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    effie: effieData,
    upload: {
      videoUrl: "https://s3.../presigned-video-url",
      coverUrl: "https://s3.../presigned-cover-url",
    },
  }),
}).then((r) => r.json());

// Connect to SSE for progress
const events = new EventSource(url);
events.addEventListener("complete", (e) => {
  const { timings } = JSON.parse(e.data);
  console.log("Uploaded!", timings);
  events.close();
});
```

**Warmup and render in one stream:**

```typescript
const { url } = await fetch("http://localhost:2000/warmup-and-render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData, scale: 0.5 }),
}).then((r) => r.json());

// Connect to SSE for combined progress
const events = new EventSource(url);

events.addEventListener("warmup:progress", (e) => {
  const { url, status, cached, total } = JSON.parse(e.data);
  console.log(`Warmup: ${cached}/${total} - ${url} ${status}`);
});

events.addEventListener("render:started", () => {
  console.log("Rendering started...");
});

events.addEventListener("complete", (e) => {
  const { videoUrl } = JSON.parse(e.data);
  console.log("Ready! Video at:", videoUrl);
  events.close();
});
```

## Related Packages

- [`@effing/effie`](../effie) — Define video compositions
- [`@effing/annie`](../annie) — Generate animations for layers
