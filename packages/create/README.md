# @effing/create

**Scaffold a new Effing project with the starter template.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

## Usage

```bash
# Using npm
npm create @effing my-app

# Using pnpm
pnpm create @effing my-app

# Using yarn
yarn create @effing my-app

# Using npx directly
npx @effing/create my-app
```

Then:

```bash
cd my-app
npm install
npm run dev
```

Open [http://localhost:3839](http://localhost:3839) to see your project.

## What's included

The starter template includes:

- **React Router** for routing and nifty preview pages
- **Annies** — Frame-based animations streamed as TAR archives
- **Effies** — Video compositions combining animations, images, and audio
- **FFS integration** — A “Render it FFS” button that can POST your Effie JSON to an `@effing/ffs` server (which you can run locally or remotely)
- Example annies and effies to get you started

## Development

This package is part of the Effing monorepo.

### Testing locally

```bash
# From the monorepo root
cd packages/create
pnpm install
pnpm build

# Test the CLI (creates a project outside the monorepo)
node dist/index.js /tmp/test-effing-app
```

### Updating the template

1. Make changes in `demos/starter`
2. Run `pnpm build` in this package
3. The `prebuild` script automatically copies `demos/starter` → `template/`, renaming dotfiles and replacing `workspace:*` versions
