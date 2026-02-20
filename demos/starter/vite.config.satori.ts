import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const workerEntry = fileURLToPath(import.meta.resolve("@effing/satori/worker"));

// Second Vite build that bundles the satori worker into a single `build/satori.mjs`.
// Referenced by `app/pool.server.ts` as the worker file in production.
//
// Why bundle: The satori pool spawns worker_threads via bare `import()`. Each
// worker thread independently resolves and parses the full dependency tree on
// startup (no shared module cache with the main thread). Bundling all pure-JS
// deps into one file avoids that overhead.
//
// Why `@resvg/resvg-js` stays external: It uses a CJS runtime shim to load
// platform-specific `.node` native binaries — can't be statically bundled.
//
// Why `emptyOutDir: false`: The main app build already placed files in `build/`.
export default defineConfig({
  build: {
    ssr: true,
    outDir: "build",
    rollupOptions: {
      input: workerEntry,
      external: [/\.node$/, "@resvg/resvg-js"],
      output: {
        entryFileNames: "satori.mjs",
      },
    },
    emptyOutDir: false,
  },
  ssr: {
    noExternal: true,
  },
});
