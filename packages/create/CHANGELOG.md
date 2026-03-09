# @effing/create

## 0.18.5

## 0.18.4

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- b53e9ad: Disable caching on the Annie preview route so the player always fetches fresh frames during development.

## 0.17.1

## 0.17.0

## 0.16.0

## 0.15.1

### Patch Changes

- ea08f55: Move `satori` from a direct dependency to a peer dependency of `@effing/satori`, giving consumers control over the installed version. The starter template now lists `satori` as an explicit dependency.
- 31f1900: Bundle satori worker for production: add `vite.config.satori.ts` build step and use pre-built worker file in `pool.server.ts`.

## 0.15.0

### Minor Changes

- 639a093: Add Dockerfile and .dockerignore to starter template for container deployment
- adf62db: Add video download button to the effie preview page. After a render finishes buffering, a "Download video" link appears that saves the MP4 via a blob URL. The download URL is managed inside the render reducer (`downloadUrl` on `ready`/`done` variants, cleared automatically on re-render) with a ref for `revokeObjectURL` cleanup.
- bf082a6: Remove `satoriPoolPlugin` Vite plugin in favor of resolving the worker file from `node_modules` at runtime via `import.meta.resolve`, falling back to relative URL resolution in Vite dev

### Patch Changes

- b35600d: Show elapsed time ticker during render progress in effie preview page

## 0.14.1

## 0.14.0

### Patch Changes

- a776e90: Clean up pff preview route code
  - Replace action result type guards with `intent`/`success` discriminated union
  - Refactor render state tracking from `useState` to `useReducer`
  - Rename variables for clarity
  - Reorder form controls

## 0.13.1

## 0.13.0

## 0.12.0

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.5

## 0.10.4

## 0.10.3

## 0.10.2

## 0.10.1

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

### Patch Changes

- dedccc7: Fix service worker cache pruning in the starter template: track insertion order explicitly instead of relying on unspecified `cache.keys()` ordering, and run pruning in the background via `event.waitUntil` to avoid blocking the response.

## 0.6.1

### Patch Changes

- cab03d7: Add a service worker to the starter demo that caches FFS render responses, preventing re-fetch failures when the browser revisits one-time-consumption render URLs. Also add `crossOrigin="anonymous"` to the `EffieCoverPreview` video element.

## 0.6.0

## 0.5.0

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

## 0.1.2

### Patch Changes

- b95b803: Use `_DOT_` prefix for dotfiles to preserve underscore-prefixed files

  Previously, the runtime logic converted all underscore-prefixed files to dotfiles, which broke legitimate files like `_index.tsx` (React Router file-system routing convention). Now uses `_DOT_` prefix to distinguish renamed dotfiles from actual underscore-prefixed files.

## 0.1.1

### Patch Changes

- 9856229: Fix catalog: references not being resolved in generated package.json. The copy-template script now parses pnpm-workspace.yaml to resolve all catalog references (like zod) instead of only handling typescript. Also removes the license field from generated projects.
