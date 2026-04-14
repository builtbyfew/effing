# @effing/fn

**Pluggable function runtime for loading and executing generative modules.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Define functions that generate images, animations, or video compositions — then load and execute them through a pluggable runtime with built-in schema validation and URL building.

## Installation

```bash
npm install @effing/fn
```

## Concepts

### Function Kinds

Every function module produces one of three output types:

| Kind      | Output                  | Description                     |
| --------- | ----------------------- | ------------------------------- |
| `"image"` | `Promise<Buffer>`       | A single PNG or JPEG image      |
| `"annie"` | `AsyncIterable<Buffer>` | A stream of animation frames    |
| `"effie"` | `Promise<EffieData>`    | A declarative video composition |

### Function Modules

A function module bundles a runner with its schema and preview data:

```typescript
import { z } from "zod";
import type { ImageFnModule } from "@effing/fn";

const myImageFn: ImageFnModule = {
  propsSchema: z.object({
    title: z.string(),
    color: z.string().default("#ffffff"),
  }),
  previewProps: { title: "Hello", color: "#ff0000" },
  runner: async ({ props, bounds }) => {
    // Generate and return PNG/JPEG bytes
    return renderImage(props, bounds);
  },
};
```

- **`runner`** — Async function that receives `{ props, bounds }` and returns the output
- **`propsSchema`** — Zod schema for validating input props
- **`previewProps`** — Default props for UI previews

### Bounds

Every runner receives a `bounds` object describing the output dimensions:

```typescript
type Bounds = Readonly<{ width: number; height: number }>;
```

### Pluggable Runtime

The runtime is initialized once with a **module loader** (discovers and loads function modules) and a **URL builder** (constructs execution URLs). This keeps the core framework-agnostic — implementations are provided by the host environment.

```typescript
import { initFnRuntime } from "@effing/fn";

initFnRuntime({
  moduleLoader: myModuleLoader,
  urlBuilder: myUrlBuilder,
});
```

## Quick Start

```typescript
import { initFnRuntime, fnModule, fnUrl, fnModuleIds } from "@effing/fn";

// Initialize the runtime (once, at startup)
initFnRuntime({
  moduleLoader: myModuleLoader,
  urlBuilder: myUrlBuilder,
});

// Load and execute a function module
const mod = await fnModule("image", "social-card");
const result = await mod.runner({
  props: { title: "Hello World" },
  bounds: { width: 1200, height: 630 },
});

// Build a URL for a function
const url = await fnUrl(
  "annie",
  "intro-animation",
  { text: "Welcome" },
  { width: 1080, height: 1920 },
);

// List available modules
const imageIds = fnModuleIds("image");
```

## API Overview

### Runtime

#### `initFnRuntime(config)`

Initialize the global runtime with a module loader and URL builder. Must be called before any other runtime function.

```typescript
function initFnRuntime(config: {
  moduleLoader: FnModuleLoader;
  urlBuilder: FnUrlBuilder;
}): void;
```

#### `fnModule(kind, id)`

Load a function module by kind and ID.

```typescript
function fnModule<K extends FnKind>(kind: K, id: string): Promise<FnModule<K>>;
```

#### `fnUrl(kind, id, props, bounds)`

Build an execution URL for a function.

```typescript
function fnUrl<P extends Record<string, unknown>>(
  kind: FnKind,
  id: string,
  props: P,
  bounds: Bounds,
): Promise<EffieWebUrl>;
```

#### `fnModuleIds(kind)`

List all available module IDs for a given kind.

```typescript
function fnModuleIds(kind: FnKind): string[];
```

#### `fnModuleExists(kind, id)`

Check whether a module exists.

```typescript
function fnModuleExists(kind: FnKind, id: string): boolean;
```

### Response Helpers

Convenience functions for returning function output as HTTP responses.

#### `imageResponse(bytes, options?)`

Create a `Response` with auto-detected MIME type (PNG or JPEG).

```typescript
function imageResponse(
  bytes: Uint8Array,
  options?: ImageResponseOptions,
): Response;
```

**Options:**

- `headers` — Additional response headers
- `cacheControl` — Cache-Control header value (default: `"public, max-age=3600"`)

#### `annieResponse(frames, options?)`

Stream animation frames as a TAR archive response.

```typescript
function annieResponse(
  frames: AsyncIterable<Buffer>,
  options?: AnnieResponseOptions,
): Response;
```

**Options:**

- `signal` — AbortSignal for cancellation
- `headers` — Additional response headers
- `cacheControl` — Cache-Control header value (default: `"public, max-age=3600"`)
- `filename` — Sets Content-Disposition filename

#### `effieResponse(data, options?)`

Serialize an Effie composition as a JSON response.

```typescript
function effieResponse<S extends EffieSources>(
  data: EffieData<S>,
  options?: EffieResponseOptions,
): Response;
```

**Options:**

- `headers` — Additional response headers
- `cacheControl` — Cache-Control header value (default: `"public, max-age=3600"`)

### Types

#### Module Loader

Implement `FnModuleLoader` to provide module discovery and loading:

```typescript
type FnModuleLoader = {
  loadModule<K extends FnKind>(kind: K, id: string): Promise<FnModule<K>>;
  listModules(kind: FnKind): string[];
  hasModule(kind: FnKind, id: string): boolean;
};
```

#### URL Builder

Implement `FnUrlBuilder` to provide URL construction:

```typescript
type FnUrlBuilder = {
  buildUrl<P extends Record<string, unknown>>(
    kind: FnKind,
    id: string,
    props: P,
    bounds: Bounds,
  ): Promise<EffieWebUrl>;
};
```

## Related Packages

- [`@effing/annie`](../annie) — Annie animation format used by `"annie"` functions
- [`@effing/effie`](../effie) — Effie composition format used by `"effie"` functions
- [`@effing/canvas`](../canvas) — Render JSX to PNG for image function runners
- [`@effing/tween`](../tween) — Step iteration and easing for animation runners
