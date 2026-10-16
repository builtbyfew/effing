import type http from "node:http";
import { createRequestListener } from "@react-router/node";
import type { ServerBuild } from "react-router";

/**
 * The dev app's request listener, on this thread or an app worker's.
 *
 * React Router's listener streams a response's body without catching its
 * errors, so an fn that fails once its response has started (an annie that
 * throws after its first frame) would reject unhandled, and stop the dev
 * server or the app worker along with every other request it serves. Log the
 * error instead, and abort the response so the client sees it failed rather
 * than a clean, truncated end.
 */
export function createAppListener(build: ServerBuild): http.RequestListener {
  const listener = createRequestListener({ build, mode: "development" });
  return async (req, res) => {
    try {
      // Typed as returning void, but it's an async function.
      await listener(req, res);
    } catch (err) {
      console.error(`Failed to serve ${req.url}:`, err);
      if (res.closed) return;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.statusCode = 500;
      res.end();
    }
  };
}
