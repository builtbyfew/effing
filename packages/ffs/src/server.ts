import express from "express";
import bodyParser from "body-parser";
import {
  createServerContext,
  createWarmupJob,
  streamWarmupProgress,
  purgeCache,
  createRenderJob,
  streamRenderProgress,
  streamRenderVideo,
  sendError,
  ErrorCode,
} from "./handlers";

const app: express.Express = express();
app.disable("x-powered-by");
app.use(bodyParser.json({ limit: "50mb" })); // Support large JSON requests

const ctx = await createServerContext();
if (ctx.httpProxy) {
  console.log(`FFS HTTP proxy listening on port ${ctx.httpProxy.port}`);
}

function validateAuth(req: express.Request, res: express.Response): boolean {
  const apiKey = process.env.FFS_API_KEY;
  if (!apiKey) return true; // No auth required if api key not set

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, "Unauthorized");
    return false;
  }
  return true;
}

// Routes with auth (POST endpoints)
app.post("/warmup", (req, res) => {
  if (!validateAuth(req, res)) return;
  createWarmupJob(req, res, ctx);
});
app.post("/purge", (req, res) => {
  if (!validateAuth(req, res)) return;
  purgeCache(req, res, ctx);
});
app.post("/render", (req, res) => {
  if (!validateAuth(req, res)) return;
  createRenderJob(req, res, ctx);
});

// Routes without auth (GET endpoints use job ID as capability token)
app.get("/warmup/:id/progress", (req, res) =>
  streamWarmupProgress(req, res, ctx),
);
app.get("/render/:id/progress", (req, res) =>
  streamRenderProgress(req, res, ctx),
);
app.get("/render/:id/video", (req, res) => streamRenderVideo(req, res, ctx));

// Server lifecycle
const port = process.env.FFS_PORT || process.env.PORT || 2000; // ffmpeg was conceived in the year 2000
const server = app.listen(port, () => {
  console.log(`FFS server listening on port ${port}`);
});

function shutdown() {
  console.log("Shutting down FFS server...");
  ctx.httpProxy?.close();
  ctx.transientStore.close();
  server.close(() => {
    console.log("FFS server stopped");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app };
