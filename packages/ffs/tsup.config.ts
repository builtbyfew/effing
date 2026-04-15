import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/handlers/index.ts", "src/sse.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["@effing/ffmpeg", "sharp"],
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: ["@effing/ffmpeg", "sharp"],
  },
]);
