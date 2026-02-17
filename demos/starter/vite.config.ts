import { reactRouter } from "@react-router/dev/vite";
import { satoriPoolPlugin } from "@effing/satori/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 3839 }, // 3839 = 0xEFF, how effing cool is that? ʘ‿ʘ
  plugins: [reactRouter(), tsconfigPaths(), satoriPoolPlugin()],
  ssr: {
    noExternal: ["yoga-wasm-web", "yoga-wasm-web/asm", "satori", "emoji-regex"],
    external: ["@resvg/resvg-js"],
  },
  optimizeDeps: {
    exclude: ["@resvg/resvg-js"],
  },
});
