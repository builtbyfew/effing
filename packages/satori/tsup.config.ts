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
    // Stage 2: worker bundle (native addons external)
    entry: { "worker/index": "src/worker/index.ts" },
    format: ["esm"],
    external: ["@resvg/resvg-js", "react", "satori"],
    dts: false,
    sourcemap: false,
    clean: false,
  },
]);
