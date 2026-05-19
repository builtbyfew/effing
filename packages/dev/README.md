# @effing/dev

**Dev server and build tooling for Effing projects.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Reduces an Effing project to just the function modules and a config file. `effing dev` boots a preview app for browsing your images, annies, and effies during development; `effing build` bundles a simple HTTP server that can serve them in production.

## Installation

```bash
npm install -D @effing/dev
```

Or scaffold a starter project with everything wired up:

```bash
npm create @effing my-app
```

## Configuration

Create an `effing.config.ts` at the root of your project:

```typescript
import { defineConfig } from "@effing/dev";

export default defineConfig({
  project: "my-app",
  images: "app/images/*.fn.tsx",
  annies: "app/annies/*.fn.tsx",
  effies: "app/effies/*.fn.tsx",
});
```

Glob patterns can be strings or arrays. Each matched file should export a function module (see [`@effing/fn`](../fn)). The file's basename — without `.fn.tsx` — becomes the module's ID, so `app/images/social-card.fn.tsx` registers as `social-card`.

### Options

| Option    | Type                               | Description                                                                                                                                                      |
| --------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project` | `string`                           | Project name. Required.                                                                                                                                          |
| `images`  | `string \| string[]`               | Glob(s) for image function modules.                                                                                                                              |
| `annies`  | `string \| string[]`               | Glob(s) for annie function modules.                                                                                                                              |
| `effies`  | `string \| string[]`               | Glob(s) for effie function modules.                                                                                                                              |
| `dev`     | `{ host, port, ffs, resolutions }` | Dev server settings. Defaults: host `127.0.0.1`, port `3839`, `ffs: true` (auto-sidecar), `resolutions` 1080×1080 / 1080×1350 / 1080×1920 in the preview picker. |

### Environment

The dev server reads `.env`, `.env.local`, `.env.development`, `.env.development.local` from the project root and merges them into `process.env` (existing values take precedence).

| Variable       | Required | Description                                                                     |
| -------------- | -------- | ------------------------------------------------------------------------------- |
| `BASE_URL`     | yes      | Public base URL used to construct signed fn URLs. E.g. `http://localhost:3839`. |
| `SECRET_KEY`   | yes      | Secret used to sign fn segment URLs. Keep it private; rotate to invalidate.     |
| `FFS_BASE_URL` | no       | URL of an [`@effing/ffs`](../ffs) server. Enables the "Render it FFS" flow.     |
| `FFS_API_KEY`  | no       | API key for the FFS server.                                                     |

## CLI

### `effing dev`

Starts the dev server.

```bash
npx effing dev
```

| Option              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `-c, --config <p>`  | Path to `effing.config.ts` (default: auto-discover). |
| `-p, --port <n>`    | Port (default: from config or `3839`).               |
| `-h, --host <host>` | Host (default: from config or `127.0.0.1`).          |
| `--no-ffs`          | Don't auto-start the FFS sidecar.                    |

The dev server gives you:

- **Overview page** listing every image, annie, and effie in the project.
- **Preview pages** per module, with selectable resolutions and auto-reload when fn files change.
- **Raw artifact URLs** (`.bytes`, `.tar`, `.json`) for piping output into other tools.
- **Signed-segment endpoints** matching what the production server serves, so URLs built via `fnUrl` work identically in dev and prod.

If `@effing/ffs` is installed and `ffs` is enabled, an FFS sidecar is auto-spawned at startup.

### `effing url`

Prints a signed fn URL for the given props — handy for agents or `curl` fetching a specific propped variant without going through the HTML preview pages.

```bash
npx effing url <kind> <id> --props '{"text":"Hello"}' --width 1080 --height 1080
```

| Option               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `-c, --config <p>`   | Path to `effing.config.ts`.                                   |
| `-p, --props <json>` | Props as a JSON object (default: `{}`).                       |
| `-w, --width <n>`    | Width in pixels (default: first entry in `dev.resolutions`).  |
| `--height <n>`       | Height in pixels (default: first entry in `dev.resolutions`). |

Reads `BASE_URL` and `SECRET_KEY` from `.env` files in the project root.

### `effing manual`

Prints a tool-level reference for the CLI and fn module shape — designed to be piped into an agent's context so it knows how to drive the project.

```bash
npx effing manual
```

| Option             | Description                 |
| ------------------ | --------------------------- |
| `-c, --config <p>` | Path to `effing.config.ts`. |

The output is resolved against your config: it picks up your project's glob directories, dev resolutions, and the right package-manager invocation form (`pnpm exec`, `yarn`, `npx --no`, or a direct `./node_modules/.bin/effing` path).

### `effing build`

Bundles a production HTTP server to `dist/server.js`.

```bash
npx effing build
```

| Option             | Description                              |
| ------------------ | ---------------------------------------- |
| `-c, --config <p>` | Path to `effing.config.ts`.              |
| `-o, --out <p>`    | Output path (default: `dist/server.js`). |

The bundle statically imports every fn module matched by your config and wires them into an HTTP listener via [`@effing/fn/server`](../fn). Run with:

```bash
BASE_URL=https://your.app SECRET_KEY=... node dist/server.js
```

## Project Structure

A typical Effing project looks like this:

```
my-app/
├── effing.config.ts
├── app/
│   ├── images/
│   │   └── social-card.fn.tsx
│   ├── annies/
│   │   └── intro.fn.tsx
│   └── effies/
│       └── promo.fn.tsx
└── package.json
```

Each `*.fn.tsx` file exports a function module (`runner`, `propsSchema`, `previewProps`). See [`@effing/fn`](../fn) for the module shape.

## API

### `defineConfig(config)`

Identity helper for `effing.config.ts` with full TypeScript inference.

```typescript
import { defineConfig } from "@effing/dev";

export default defineConfig({
  project: "my-app",
  images: "app/images/*.fn.tsx",
});
```

## Related Packages

- [`@effing/fn`](../fn) — Function module runtime (used by both dev and build)
- [`@effing/ffs`](../ffs) — FFmpeg renderer for effie compositions
- [`@effing/effie-preview`](../effie-preview) — Preview components used by the dev UI
- [`@effing/create`](../create) — Scaffold a new Effing project
