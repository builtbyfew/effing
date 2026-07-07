# @effing/ffs

**FFmpeg-based video renderer for Effie compositions.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Takes an `EffieData` composition and renders it to an MP4 video using FFmpeg. Use as a library, run as a standalone HTTP server, or render directly from the command line.

## Installation

```bash
npm install @effing/ffs
```

FFmpeg is bundled via `@effing/ffmpeg` — no system installation required.

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

### As a CLI

Render an Effie composition (URL or local JSON file) directly to an MP4:

```bash
# From a URL
npx @effing/ffs render https://example.com/composition.json output.mp4

# From a local file, at 50% scale
npx @effing/ffs render ./composition.json output.mp4 --scale 0.5
```

Options: `--scale <n>`, `--skip-validation`, `--allow-local-files`, `-h`/`--help`.

### As an HTTP Server

```bash
# Run the server (default, equivalent to `ffs serve`)
npx @effing/ffs

# Or with custom port
FFS_PORT=8080 npx @effing/ffs
```

Rendering is a two-step process: POST to create a job, then connect to the SSE progress stream to track warmup and rendering. The video URL is revealed in the `ready` event.

```bash
# 1. Create a render job
curl -X POST http://localhost:2000/render \
  -H "Content-Type: application/json" \
  -d '{"effie": ...}'
# Returns: { "id": "...", "progressUrl": "http://localhost:2000/render/.../progress" }

# 2. Connect to SSE progress stream (or use EventSource in browser)
curl http://localhost:2000/render/.../progress
# SSE events: warmup:start, warmup:progress, warmup:complete, ready (with videoUrl)

# 3. Fetch the video
curl http://localhost:2000/render/.../video -o output.mp4
```

> [!NOTE]
> The server uses an internal HTTP proxy for video/audio URLs to ensure reliable DNS resolution in containerized environments (e.g., Alpine Linux). This is why you might see another server running on a random port.

#### Environment Variables

| Variable                         | Description                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FFS_PORT`                       | Server port (default: 2000, falls back to `PORT`)                                                                                                                    |
| `FFS_BASE_URL`                   | Base URL for returned URLs                                                                                                                                           |
| `FFS_API_KEY`                    | API key for authentication (optional)                                                                                                                                |
| `FFS_TRANSIENT_STORE_BUCKET`     | S3 bucket for transient store (enables S3 mode)                                                                                                                      |
| `FFS_TRANSIENT_STORE_ENDPOINT`   | S3-compatible endpoint (for e.g. R2 or MinIO)                                                                                                                        |
| `FFS_TRANSIENT_STORE_REGION`     | AWS region (default: "auto")                                                                                                                                         |
| `FFS_TRANSIENT_STORE_PREFIX`     | Key prefix for stored objects                                                                                                                                        |
| `FFS_TRANSIENT_STORE_ACCESS_KEY` | S3 access key ID                                                                                                                                                     |
| `FFS_TRANSIENT_STORE_SECRET_KEY` | S3 secret access key                                                                                                                                                 |
| `FFS_TRANSIENT_STORE_LOCAL_DIR`  | Local storage directory (when not using S3)                                                                                                                          |
| `FFS_TRANSIENT_STORE_TTL_MS`     | TTL for all transient data in ms (default: 60 min)                                                                                                                   |
| `FFS_WARMUP_CONCURRENCY`         | Concurrent source fetches during warmup (default: 4)                                                                                                                 |
| `FFS_ALLOW_PRIVATE_NETWORKS`     | Allow fetches to private/internal IPs. Default: `true` outside production, `false` when `NODE_ENV=production`. Set to `false` to enforce SSRF protection everywhere. |
| `FFS_SKIP_VALIDATION`            | Skip Effie schema validation of request bodies (trusts input). Default: off.                                                                                         |
| `FFMPEG`                         | Path to an FFmpeg binary, overriding the bundled `@effing/ffmpeg`.                                                                                                   |

When `FFS_API_KEY` is set, the POST endpoints require an `Authorization: Bearer <key>` header. The GET progress/video endpoints are deliberately left open: they are capability URLs whose unguessable job IDs are only revealed in responses from the authenticated POSTs, which allows browser players to consume them directly.

When `FFS_TRANSIENT_STORE_BUCKET` is not set, FFS uses the local filesystem for storage (default: system temp directory). Local files are automatically cleaned up after the TTL expires.

For S3 storage, the TTL is set as the `Expires` header on objects. Note that this is metadata only. To enable automatic deletion, configure [S3 lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) on your bucket to delete expired objects.

## API Overview

### EffieRenderer

```typescript
class EffieRenderer {
  constructor(
    effieData: EffieData<EffieSources>,
    options?: EffieRendererOptions,
  );

  // Render composition
  render(scaleFactor?: number): Promise<Readable>;

  // Clean up FFmpeg process
  close(): void;
}
```

`EffieRendererOptions` is optional:

| Option            | Type             | Default     | Description                                                                                     |
| ----------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `allowLocalFiles` | `boolean`        | `false`     | Allow reading from local file paths. Only enable for trusted internal operations.               |
| `transientStore`  | `TransientStore` | _(network)_ | Transient store for source lookups. If omitted, sources are fetched directly from the network.  |
| `httpProxy`       | `HttpProxy`      | —           | Routes HTTP(S) video/audio URLs through a proxy so Node.js handles DNS (e.g. Alpine/musl libc). |

### FFmpegCommand & FFmpegRunner

Lower-level classes for building and executing FFmpeg commands:

```typescript
import { FFmpegCommand, FFmpegRunner } from "@effing/ffs";

const cmd = new FFmpegCommand(globalArgs, inputs, filterComplex, outputArgs);
const runner = new FFmpegRunner(cmd);

// run(sourceFetcher, imageTransformer?, referenceResolver?, urlTransformer?)
// where sourceFetcher: ({ type, src }) => Promise<Readable>
const output = await runner.run(sourceFetcher);
```

## Server Endpoints

When running as an HTTP server, FFS provides endpoints for rendering, cache warmup, and cache purging.

### `POST /render`

Creates a render job that includes warmup and render phases. Supports optional cache purging.

**Request:**

```typescript
type RenderOptions = {
  effie: EffieData | string; // EffieData object or URL to fetch from
  scale?: number; // Scale factor (default: 1)
  purge?: boolean; // Purge cached sources before warmup
  upload?: {
    videoUrl: string; // Pre-signed URL to upload rendered video
    coverUrl?: string; // Pre-signed URL to upload cover image
  };
};
```

Alternatively, raw `EffieData` can be sent directly as the request body. When using the raw format, `scale` and `purge` can be passed as query parameters: `?scale=0.5&purge=true`.

When `effie` is a URL, the fetch is deferred to the progress stream (`GET /render/:id/progress`). The POST returns immediately, and the `effie:fetching`/`effie:fetched` SSE events report fetch progress. Any fetch or validation errors are reported as SSE `error` events with `phase: "effie"`.

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "progressUrl": "http://localhost:2000/render/550e8400-e29b-41d4-a716-446655440000/progress"
}
```

### `GET /render/:id/progress`

Streams warmup and render progress via SSE. All warmup events are prefixed with `warmup:`, render events with `render:`.

**Events:**

| Event                | Phase  | Data                                                                                                 |
| -------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `effie:fetching`     | effie  | `{ url }` — sent when fetching a deferred Effie URL                                                  |
| `effie:fetched`      | effie  | `{ url }` — sent after the Effie URL has been fetched and validated                                  |
| `purge:complete`     | purge  | `{ purged: number, total: number }`                                                                  |
| `warmup:start`       | warmup | `{ total: number }`                                                                                  |
| `warmup:progress`    | warmup | `{ url, status: "skipped", reason: "http-video-audio-passthrough", cached, failed, skipped, total }` |
|                      |        | `{ url, status: "hit", cached, failed, skipped, total }`                                             |
|                      |        | `{ url, status: "cached", cached, failed, skipped, total, ms }`                                      |
|                      |        | `{ url, status: "error", error, cached, failed, skipped, total, ms }`                                |
| `warmup:downloading` | warmup | `{ url, status: "started", bytesReceived: 0 }` — sent once when download begins                      |
|                      |        | `{ url, status: "downloading", bytesReceived }` — sent every ~10 s during download                   |
| `warmup:keepalive`   | warmup | `{ cached, failed, skipped, total }` — sent every ~25 s during source fetching                       |
| `warmup:summary`     | warmup | `{ cached, failed, skipped, total }`                                                                 |
| `warmup:complete`    | warmup | `{ status: "ready" }`                                                                                |
| `keepalive`          | all    | `{ phase: "effie" \| "warmup" \| "render" \| "upload" }` — sent every ~25 s                          |
| `render:complete`    | render | `{ renderTime?, fetchCoverTime?, uploadCoverTime?, uploadTime }` (upload mode; all values in ms)     |
| `ready`              | —      | `{ videoUrl }` (non-upload mode)                                                                     |
| `complete`           | —      | `{ status: "done" }` (upload mode)                                                                   |
| `error`              | any    | `{ phase: "effie" \| "warmup" \| "render" \| "upload", message, code }`                              |

**Without upload** — The `ready` event provides a `videoUrl` pointing to `/render/:id/video`. The actual rendering happens when you fetch that URL:

```typescript
const events = new EventSource(progressUrl);
events.addEventListener("ready", (e) => {
  const { videoUrl } = JSON.parse(e.data);
  // Fetch videoUrl to stream the rendered video
  events.close();
});
```

**With upload** — Uploads directly and streams progress:

```typescript
const events = new EventSource(progressUrl);
events.addEventListener("render:complete", (e) => {
  const { renderTime, uploadTime } = JSON.parse(e.data);
  console.log("Uploaded!", { renderTime, uploadTime });
});
events.addEventListener("complete", () => {
  events.close();
});
```

### `GET /render/:id/video`

Streams the rendered MP4 video (non-upload mode only). Returns 404 until the warmup phase completes and the video sub-job is created.

```bash
curl http://localhost:2000/render/550e8400-.../video -o output.mp4
```

### `POST /warmup`

Creates a standalone warmup job for pre-fetching and caching the sources from an Effie composition.

**Request:** Same format as `/render` — wrapped EffieData with `effie` field, or raw `EffieData` directly as the body.

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "progressUrl": "http://localhost:2000/warmup/550e8400-e29b-41d4-a716-446655440000/progress"
}
```

### `GET /warmup/:id/progress`

Runs the cache warmup job and streams the progress via Server-Sent Events (SSE). Connect with `EventSource` for real-time updates.

**Events:**

| Event         | Data                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `start`       | `{ total: number }`                                                                                  |
| `progress`    | `{ url, status: "skipped", reason: "http-video-audio-passthrough", cached, failed, skipped, total }` |
|               | `{ url, status: "hit", cached, failed, skipped, total }`                                             |
|               | `{ url, status: "cached", cached, failed, skipped, total, ms }`                                      |
|               | `{ url, status: "error", error, cached, failed, skipped, total, ms }`                                |
| `downloading` | `{ url, status: "started", bytesReceived: 0 }` — sent once when download begins                      |
|               | `{ url, status: "downloading", bytesReceived }` — sent every ~10 s during download                   |
| `keepalive`   | `{ cached, failed, skipped, total }` — sent every ~25 s during source fetching                       |
| `summary`     | `{ cached, failed, skipped, total }`                                                                 |
| `complete`    | `{ status: "ready" }`                                                                                |
| `error`       | `{ message, code }`                                                                                  |

**Example:**

```typescript
// Create warmup job
const { progressUrl } = await fetch("/warmup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData }),
}).then((r) => r.json());

// Stream progress
const events = new EventSource(progressUrl);
events.addEventListener("complete", () => {
  events.close();
  // Now safe to call /render
});
```

### `POST /purge`

Purges cached sources for a given Effie composition.

**Request:** Same format as `/render` — wrapped EffieData with `effie` field, or raw `EffieData` directly as the body.

**Response:**

```json
{ "purged": 3, "total": 5 }
```

### Error Responses

All HTTP error responses share a unified JSON shape:

```typescript
type ApiError = {
  error: string; // Human-readable message
  code: ErrorCode; // Machine-readable code
  issues?: Array<{ path: string; message: string }>; // Validation details (Zod failures only)
};
```

| Code             | Status | Description                               |
| ---------------- | ------ | ----------------------------------------- |
| `UNAUTHORIZED`   | 401    | Missing or invalid API key                |
| `INVALID_EFFIE`  | 400    | Effie data validation or structural error |
| `NOT_FOUND`      | 404    | Job or video not found                    |
| `BACKEND_FAILED` | varies | Remote render backend returned an error   |
| `FETCH_FAILED`   | 422    | A source URL could not be fetched         |
| `INTERNAL_ERROR` | 500    | Catch-all for unhandled exceptions        |

For `INVALID_EFFIE` errors caused by schema validation, the `issues` array contains the specific validation failures:

```json
{
  "error": "Invalid effie data",
  "code": "INVALID_EFFIE",
  "issues": [{ "path": "segments.0.layers.0.x", "message": "Required" }]
}
```

## Backend Separation

FFS supports running warmup and render on separate backends via resolver callbacks.
When backends are configured, the transient storage must be shared between services (e.g., using S3).

### Setup

Pass resolvers to `createServerContext`:

```typescript
import { createServerContext } from "@effing/ffs/handlers";
import type {
  RenderBackendResolver,
  WarmupBackendResolver,
} from "@effing/ffs/handlers";

const renderBackendResolver: RenderBackendResolver = (effie, metadata) => ({
  baseUrl: "https://render.your.app",
  apiKey: "secret",
});

const warmupBackendResolver: WarmupBackendResolver = (sources, metadata) => ({
  baseUrl: "https://warmup.your.app",
  apiKey: "secret",
});

const ctx = await createServerContext({
  renderBackendResolver,
  warmupBackendResolver,
});
```

The `warmupBackendResolver` determines where warmup _work_ happens — used by `/warmup/:id/progress` and the warmup phase within `/render/:id/progress`. The `renderBackendResolver` determines where video rendering _work_ happens — used by `/render/:id/video` and the render+upload phase in upload mode.

Both resolvers receive optional metadata (passed via handler options). Return `null` to handle locally.

### Job metadata

Pass server-side metadata to be stored with the job and forwarded to the resolver:

```typescript
createRenderJob(req, res, ctx, { metadata: { tenantId: "abc" } });
createWarmupJob(req, res, ctx, { metadata: { tenantId: "abc" } });
```

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
const { progressUrl } = await fetch("http://localhost:2000/render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData, scale: 0.5 }),
}).then((r) => r.json());

// Connect to SSE progress
const events = new EventSource(progressUrl);
events.addEventListener("ready", (e) => {
  const { videoUrl } = JSON.parse(e.data);
  // Fetch the video (rendering happens on-demand)
  const video = await fetch(videoUrl).then((r) => r.blob());
  events.close();
});
```

**Render with cache purge:**

```typescript
const { progressUrl } = await fetch("http://localhost:2000/render", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effie: effieData, scale: 0.5, purge: true }),
}).then((r) => r.json());
```

**Render and upload to S3 (SSE progress):**

```typescript
const { progressUrl } = await fetch("http://localhost:2000/render", {
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
const events = new EventSource(progressUrl);
events.addEventListener("complete", () => {
  console.log("Done!");
  events.close();
});
```

## Related Packages

- [`@effing/effie`](../effie) — Define video compositions
- [`@effing/annie`](../annie) — Generate animations for layers
