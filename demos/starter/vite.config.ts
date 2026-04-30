import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Chrome DevTools probes this URL when the inspector is open; short-circuit it
// so it doesn't reach the React Router handler and log a noisy 404.
const silenceChromeDevtoolsProbe: Plugin = {
  name: "silence-chrome-devtools-probe",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/.well-known/appspecific/com.chrome.devtools.json") {
        res.statusCode = 204;
        res.end();
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  server: { port: 3839 }, // 3839 = 0xEFF, how effing cool is that? ʘ‿ʘ
  plugins: [silenceChromeDevtoolsProbe, reactRouter(), tsconfigPaths()],
  optimizeDeps: {
    exclude: ["@effing/canvas"],
  },
  ssr: {
    external: ["@effing/canvas"],
  },
});
