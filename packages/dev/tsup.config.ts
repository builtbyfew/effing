import { defineConfig } from "tsup";

export default defineConfig([
  {
    name: "lib",
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    name: "cli",
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    // Transpile-only (bundle: false) so the `virtual:effing/fns` import
    // survives in the output for esbuild's plugin to resolve at user
    // `effing build` time.
    name: "prod-server-entry",
    entry: { "server/prod/entry": "src/server/prod/entry.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    bundle: false,
  },
]);
