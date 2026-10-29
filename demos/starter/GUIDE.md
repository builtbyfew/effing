# Guide

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

(`pnpm` and `yarn` work the same — substitute as you prefer.)

Open [http://localhost:3839](http://localhost:3839) — the homepage lists every image, annie, and effie in the project with links to their preview pages. `npm run dev` also starts a local FFS rendering service alongside the app, so the "Render it FFS" button on effie previews works out of the box.

## Path alias

This project is configured with a `~/*` path alias pointing at `app/*` (see `tsconfig.json`). Import project files via `~/fonts`, `~/annies/my-animation.fn`, etc., rather than long relative paths.

## Fonts

`app/fonts.ts` defines the project's font helpers — a small `loadFonts(fonts)` utility and a few Google Fonts ready to import:

```ts
import {
  loadFonts,
  interBold,
  interSemiBold,
  robotoRegular,
  robotoBold,
  openSansRegular,
  openSansSemiBold,
} from "~/fonts";

const fonts = await loadFonts([interBold, robotoRegular]);
```

To add another font, copy one of the existing exports in `app/fonts.ts` and point it at the relevant `https://fonts.gstatic.com/s/...ttf` URL. Fonts are fetched at runtime — never bundle them, since that limits where your fns can run. See `effing manual` → "Fonts" for the underlying `FontData` shape.

## Environment variables

```bash
# Secret for signing URL segments. Optional in dev (a throwaway key is
# generated per run); required for `npm run url` and in production,
# where it should be a unique random value
# SECRET_KEY=
# Optional in dev (defaults to the dev server's own address); required in production
BASE_URL=http://localhost:3839

# Optional: FFS rendering service (only when pointing at a remote FFS —
# the local sidecar is wired up automatically)
FFS_BASE_URL=https://your-ffs.example.com
FFS_API_KEY=your-ffs-api-key
```

## Scripts

| Script                     | What it does                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`              | Runs the Effing dev server and a local FFS rendering service.           |
| `npm run render`           | Renders a fn to a file, no dev server needed (see `effing manual`).     |
| `npm run url`              | Mints a signed fn URL for given props (see `effing manual`).            |
| `npm run build`            | Bundles a production server to `dist/server.js`.                        |
| `npm start`                | Runs the production server (`node dist/server.js`).                     |
| `npm run typecheck`        | Runs `tsc`.                                                             |
| `npm run cloud:deploy`     | Deploys to [Effing Cloud](https://effing.dev) using `effing.config.ts`. |
| `npm run cloud:url-secret` | Prints the project's URL signing secret from Effing Cloud.              |

## Deploying

[Effing Cloud](https://effing.dev) is the easiest path: `npm run cloud:deploy` ships the project (configured via `effing.config.ts`) and everything around running it in production is handled for you. To self-host instead, use the included `Dockerfile` — `effing build` produces a small Node server that the Dockerfile runs with `node dist/server.js`.

### Deploying from CI and scripts

`effing-cloud login` saves a key for your machine through a browser login, and `effing-cloud logout` revokes it. For CI and other scripts, create an API key on the Credentials page of the Effing Cloud console (account owners only) and set it as `EFFING_CLOUD_API_KEY`. It takes precedence over any saved login, and `effing-cloud --help` lists it with the other environment variables.

```bash
export EFFING_CLOUD_API_KEY=...   # from a CI secret, never committed
npx effing-cloud whoami           # fails with a non-zero exit code if the key is rejected
npx effing-cloud deploy --json > deploy.json
jq -r '.version' deploy.json
jq -r '.previews[] | "\(.kind)/\(.id) \(.url)"' deploy.json
```

With `--json`, `deploy` prints one JSON document to stdout (version, deployment id, bundle hash and size, and a preview URL per fn) and moves its progress lines to stderr. `effing-cloud urls --json` prints the preview URLs of the active deployment as `{ "account", "project", "urls": [{ "kind", "id", "url" }] }`.
