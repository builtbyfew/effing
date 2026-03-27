import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: [
      "src/index.ts",
      "src/server.ts",
      "src/handlers/index.ts",
      "src/sse.ts",
    ],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["@effing/ffmpeg", "sharp"],
  },
  {
    entry: ["src/server.ts"],
    format: ["esm"],
    dts: false,
    sourcemap: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: ["@effing/ffmpeg", "sharp"],
  },
]);
