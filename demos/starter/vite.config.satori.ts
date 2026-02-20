import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const workerEntry = fileURLToPath(import.meta.resolve("@effing/satori/worker"));

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
