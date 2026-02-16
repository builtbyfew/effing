import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Stage 1: main + serde + pool (with .d.ts)
    entry: {
      index: "src/index.ts",
      "serde/index": "src/serde/index.ts",
      "pool/index": "src/pool/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["react", "tinypool"],
  },
  {
    // Stage 2: worker bundle (satori bundled in, native addons external)
    entry: { "worker/index": "src/worker/index.ts" },
    format: ["esm"],
    noExternal: ["satori"],
    external: ["@resvg/resvg-js", "react"],
    dts: false,
    sourcemap: false,
    clean: false,
  },
]);
