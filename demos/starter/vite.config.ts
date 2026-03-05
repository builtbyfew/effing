import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: { port: 3839 }, // 3839 = 0xEFF, how effing cool is that? ʘ‿ʘ
  plugins: [reactRouter(), tsconfigPaths()],
  optimizeDeps: {
    exclude: ["@effing/canvas"],
  },
  ssr: {
    external: ["@effing/canvas"],
  },
});
