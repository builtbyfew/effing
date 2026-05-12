import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Used only by `react-router build` to compile the preview app shipped with
// @effing/dev. Not consulted at user dev time — the dev server boots a
// separate Vite instance in middleware mode for the SSR module runner.
export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  // Externalize packages whose module-level state must be shared with the
  // runner that loads user fns at dev time. If `@effing/fn` is inlined into
  // the SSR bundle, its singleton lives there — while the user fn's
  // `@effing/fn` import resolves through Node's process-wide cache. The two
  // never see each other and `initFnRuntime()` writes to the wrong slot.
  ssr: {
    external: ["@effing/fn"],
  },
});
