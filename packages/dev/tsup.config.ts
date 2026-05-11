import { defineConfig } from "tsup";

export default defineConfig([
  {
    name: "lib",
    entry: {
      index: "src/index.ts",
      "vite-plugin": "src/vite-plugin.ts",
    },
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
]);
