import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin, ResolvedConfig } from "vite";

/**
 * Vite plugin that bundles the `@effing/satori` worker into the SSR output and
 * rewrites `createSatoriPool()` calls to point at it.
 *
 * **This plugin is required for production SSR builds.** Without it the worker
 * path resolved via `import.meta.url` breaks after Vite bundles the pool code,
 * because the URL points at the build output directory instead of `node_modules`.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { satoriPoolPlugin } from "@effing/satori/vite";
 *
 * export default defineConfig({
 *   plugins: [satoriPoolPlugin()],
 * });
 * ```
 */
export function satoriPoolPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "@effing/satori:worker",
    apply: "build",

    config() {
      return { ssr: { external: ["tinypool"] } };
    },

    configResolved(config) {
      resolvedConfig = config;
    },

    transform(code, _id, options) {
      if (!options?.ssr) return;

      const pattern = /\bcreateSatoriPool\(\s*(\)|\{)/g;
      let matched = false;
      const result = code.replace(pattern, (_match, capture: string) => {
        matched = true;
        if (capture === ")") {
          return 'createSatoriPool({ workerFile: "__SATORI_WORKER_FILE__" })';
        }
        // capture === "{"
        return 'createSatoriPool({ workerFile: "__SATORI_WORKER_FILE__", ';
      });

      if (!matched) return;
      return { code: result, map: null };
    },

    renderChunk(code, chunk) {
      const placeholder = '"__SATORI_WORKER_FILE__"';
      if (!code.includes(placeholder)) return;

      const chunkDir = posix.dirname(chunk.fileName);
      const relToRoot = chunkDir === "." ? "." : posix.relative(chunkDir, ".");
      const workerRel = posix.join(relToRoot, "satori-worker.js");
      const expr = `import.meta.dirname + ${JSON.stringify("/" + workerRel)}`;

      return {
        code: code.replaceAll(placeholder, expr),
        map: null,
      };
    },

    async writeBundle(outputOptions) {
      if (!resolvedConfig.build.ssr) return;

      const workerEntry = fileURLToPath(
        new URL("../worker/index.js", import.meta.url),
      );
      const outDir = outputOptions.dir ?? resolvedConfig.build.outDir;

      const { build } = await import("vite");
      await build({
        configFile: false,
        logLevel: "silent",
        build: {
          write: true,
          emptyOutDir: false,
          outDir,
          lib: {
            entry: workerEntry,
            formats: ["es"],
            fileName: () => "satori-worker.js",
          },
          rollupOptions: {
            external: ["@resvg/resvg-js"],
          },
        },
      });
    },
  };
}
