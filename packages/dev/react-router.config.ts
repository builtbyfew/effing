import type { Config } from "@react-router/dev/config";

// Build config for the preview app shipped with @effing/dev. The preview
// is pre-built at @effing/dev package build time and the resulting Node
// SSR handler is loaded by `startDevServer()` at user dev time.
export default {
  appDirectory: "./src/server/dev/app",
  buildDirectory: "./dist/server/dev/app",
  ssr: true,
} satisfies Config;
