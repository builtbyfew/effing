import express from "express";
import { randomUUID } from "crypto";
import { storeKeys } from "../storage";
import { ffsFetch } from "../fetch";
import {
  extractEffieSourcesWithTypes,
  extractEffieSources,
  effieDataSchema,
} from "@effing/effie";
import type { EffieData, EffieSources } from "@effing/effie";
import type {
  ServerContext,
  SSEEventSender,
  RenderJob,
  VideoJob,
  UploadOptions,
} from "./shared";
import {
  setupCORSHeaders,
  setupSSEResponse,
  createSSEEventSender,
  prefixEventSender,
  proxyRemoteSSE,
  proxyBinaryStream,
} from "./shared";
import { warmupSources, purgeCachedSources } from "./caching";

/**
 * POST /render - Create a render job (warmup + render, optional purge)
 * Returns a job ID and progress URL for SSE streaming
 */
export async function createRenderJob(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
  options?: { metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    // Parse request body
    const body = req.body as {
      effie: unknown;
      scale?: number;
      upload?: UploadOptions;
      purge?: boolean;
    };

    let rawEffieData: unknown;
    if (typeof body.effie === "string") {
      // Effie is a URL to fetch the EffieData from
      const response = await ffsFetch(body.effie);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch Effie data: ${response.status} ${response.statusText}`,
        );
      }
      rawEffieData = await response.json();
    } else {
      rawEffieData = body.effie;
    }

    // Validate/parse effie data
    let effie: EffieData<EffieSources>;
    if (!ctx.skipValidation) {
      const result = effieDataSchema.safeParse(rawEffieData);
      if (!result.success) {
        res.status(400).json({
          error: "Invalid effie data",
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }
      effie = result.data;
    } else {
      const data = rawEffieData as EffieData<EffieSources>;
      if (!data?.segments) {
        res.status(400).json({ error: "Invalid effie data: missing segments" });
        return;
      }
      effie = data;
    }

    const sources = extractEffieSourcesWithTypes(effie);
    const scale = body.scale ?? 1;
    const upload = body.upload;
    const purge = body.purge;

    // Create IDs
    const jobId = randomUUID();
    const warmupJobId = randomUUID();

    // Store the render job
    const job: RenderJob = {
      effie,
      sources,
      scale,
      upload,
      purge,
      warmupJobId,
      createdAt: Date.now(),
      metadata: options?.metadata,
    };

    await ctx.transientStore.putJson(
      storeKeys.renderJob(jobId),
      job,
      ctx.transientStore.ttlMs,
    );

    // Store warmup sub-job for backend execution
    await ctx.transientStore.putJson(
      storeKeys.warmupJob(warmupJobId),
      { sources, metadata: options?.metadata },
      ctx.transientStore.ttlMs,
    );

    res.json({
      id: jobId,
      progressUrl: `${ctx.baseUrl}/render/${jobId}/progress`,
    });
  } catch (error) {
    console.error("Error creating render job:", error);
    res.status(500).json({ error: "Failed to create render job" });
  }
}

/**
 * GET /render/:id/progress - Stream render progress via SSE
 * Orchestrates warmup (local or remote) followed by render (local or remote)
 */
export async function streamRenderProgress(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
): Promise<void> {
  try {
    setupCORSHeaders(res);

    const jobId = req.params.id;
    const jobStoreKey = storeKeys.renderJob(jobId);
    const job = await ctx.transientStore.getJson<RenderJob>(jobStoreKey);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    // Only allow the job to run once
    ctx.transientStore.delete(jobStoreKey);

    // Resolve backends up front
    const warmupBackend = ctx.warmupBackendResolver
      ? ctx.warmupBackendResolver(job.sources, job.metadata)
      : null;
    const renderBackend = ctx.renderBackendResolver
      ? ctx.renderBackendResolver(job.effie, job.metadata)
      : null;

    setupSSEResponse(res);
    const sendEvent = createSSEEventSender(res);

    // Keepalive interval for long-running operations
    let keepalivePhase: "warmup" | "render" = "warmup";
    const keepalive = setInterval(() => {
      sendEvent("keepalive", { phase: keepalivePhase });
    }, 25_000);

    try {
      // Phase 0: Purge (if requested)
      if (job.purge) {
        const sourceUrls = extractEffieSources(job.effie);
        const purgeResult = await purgeCachedSources(
          sourceUrls,
          ctx.transientStore,
        );
        sendEvent("purge:complete", purgeResult);
      }

      // Phase 1: Warmup
      if (warmupBackend) {
        // Proxy warmup from remote backend
        await proxyRemoteSSE(
          `${warmupBackend.baseUrl}/warmup/${job.warmupJobId}/progress`,
          sendEvent,
          "warmup:",
          res,
          warmupBackend.apiKey
            ? { Authorization: `Bearer ${warmupBackend.apiKey}` }
            : undefined,
        );
      } else {
        // Local warmup execution
        const warmupSender = prefixEventSender(sendEvent, "warmup:");
        await warmupSources(job.sources, warmupSender, ctx);
        warmupSender("complete", { status: "ready" });
      }

      // Phase 2: Render
      keepalivePhase = "render";

      if (job.upload) {
        if (renderBackend) {
          // Upload + backend: store VideoJob for backend to render,
          // fetch binary video from backend, upload locally.
          const videoJob: VideoJob = {
            effie: job.effie,
            scale: job.scale,
          };
          await ctx.transientStore.putJson(
            storeKeys.videoJob(jobId),
            videoJob,
            ctx.transientStore.ttlMs,
          );

          const backendUrl = `${renderBackend.baseUrl}/render/${jobId}/video`;
          const response = await ffsFetch(backendUrl, {
            headers: renderBackend.apiKey
              ? { Authorization: `Bearer ${renderBackend.apiKey}` }
              : undefined,
          });
          if (!response.ok) {
            throw new Error(`Backend render failed: ${response.status}`);
          }
          const videoBuffer = Buffer.from(await response.arrayBuffer());

          const timings = await uploadRenderedVideo(
            videoBuffer,
            job.effie,
            job.upload,
            sendEvent,
          );
          sendEvent("render:complete", timings);
        } else {
          // Upload + no backend: render and upload locally (no VideoJob stored)
          const timings = await renderAndUploadInternal(
            job.effie,
            job.scale,
            job.upload,
            sendEvent,
            ctx,
          );
          sendEvent("render:complete", timings);
        }
        sendEvent("complete", { status: "done" });
      } else {
        // Non-upload mode: store VideoJob for on-demand fetch via /render/:id/video
        const videoJob: VideoJob = {
          effie: job.effie,
          scale: job.scale,
        };
        await ctx.transientStore.putJson(
          storeKeys.videoJob(jobId),
          videoJob,
          ctx.transientStore.ttlMs,
        );
        const videoUrl = `${ctx.baseUrl}/render/${jobId}/video`;
        sendEvent("ready", { videoUrl });
      }
    } catch (error) {
      sendEvent("error", {
        phase: keepalivePhase,
        message: String(error),
      });
    } finally {
      clearInterval(keepalive);
      res.end();
    }
  } catch (error) {
    console.error("Error in render progress streaming:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Render progress streaming failed" });
    } else {
      res.end();
    }
  }
}

/**
 * GET /render/:id/video - Stream rendered video
 * Reads the video sub-job from the store, deletes it (one-time use), and streams the MP4.
 */
export async function streamRenderVideo(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
): Promise<void> {
  try {
    setupCORSHeaders(res);

    const jobId = req.params.id;
    const videoJobKey = storeKeys.videoJob(jobId);
    const videoJob = await ctx.transientStore.getJson<VideoJob>(videoJobKey);

    if (!videoJob) {
      res.status(404).json({ error: "Video not found or expired" });
      return;
    }

    // Proxy to render backend if resolver is configured
    // Don't delete — the backend reads/deletes the VideoJob from shared store
    if (ctx.renderBackendResolver) {
      const backend = ctx.renderBackendResolver(videoJob.effie);
      if (backend) {
        const backendUrl = `${backend.baseUrl}/render/${jobId}/video`;
        const response = await ffsFetch(backendUrl, {
          headers: backend.apiKey
            ? { Authorization: `Bearer ${backend.apiKey}` }
            : undefined,
        });

        if (!response.ok) {
          res.status(response.status).json({ error: "Backend render failed" });
          return;
        }

        await proxyBinaryStream(response, res);
        return;
      }
    }

    // Local render — safe to delete the video job (one-time use)
    ctx.transientStore.delete(videoJobKey);

    // Render locally
    await streamRenderDirect(res, videoJob, ctx);
  } catch (error) {
    console.error("Error streaming video:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Video streaming failed" });
    } else {
      res.end();
    }
  }
}

/**
 * Stream video directly to the response (no upload)
 */
async function streamRenderDirect(
  res: express.Response,
  job: VideoJob,
  ctx: ServerContext,
): Promise<void> {
  const { EffieRenderer } = await import("../render");
  const renderer = new EffieRenderer(job.effie, {
    transientStore: ctx.transientStore,
    httpProxy: ctx.httpProxy,
  });
  const videoStream = await renderer.render(job.scale);

  res.on("close", () => {
    videoStream.destroy();
    renderer.close();
  });

  res.set("Content-Type", "video/mp4");
  res.set("Cache-Control", "public, immutable, max-age=86400");
  videoStream.pipe(res);
}

/**
 * Upload a rendered video buffer (and optional cover) to presigned URLs.
 * Shared between local render+upload and backend render+upload flows.
 */
async function uploadRenderedVideo(
  videoBuffer: Buffer,
  effie: EffieData<EffieSources>,
  upload: UploadOptions,
  sendEvent: SSEEventSender,
): Promise<Record<string, number>> {
  const timings: Record<string, number> = {};

  // Fetch and upload cover if coverUrl provided
  if (upload.coverUrl) {
    const fetchCoverStartTime = Date.now();
    let coverBuffer: Buffer;
    if (effie.cover.startsWith("data:")) {
      const commaIndex = effie.cover.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Invalid cover data URL");
      }
      const meta = effie.cover.slice(5, commaIndex); // after "data:"
      const isBase64 = meta.endsWith(";base64");
      const data = effie.cover.slice(commaIndex + 1);
      coverBuffer = isBase64
        ? Buffer.from(data, "base64")
        : Buffer.from(decodeURIComponent(data));
    } else {
      const coverFetchResponse = await ffsFetch(effie.cover);
      if (!coverFetchResponse.ok) {
        throw new Error(
          `Failed to fetch cover image: ${coverFetchResponse.status} ${coverFetchResponse.statusText}`,
        );
      }
      coverBuffer = Buffer.from(await coverFetchResponse.arrayBuffer());
    }
    timings.fetchCoverTime = Date.now() - fetchCoverStartTime;

    const uploadCoverStartTime = Date.now();
    const uploadCoverResponse = await ffsFetch(upload.coverUrl, {
      method: "PUT",
      body: coverBuffer,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": coverBuffer.length.toString(),
      },
    });
    if (!uploadCoverResponse.ok) {
      throw new Error(
        `Failed to upload cover: ${uploadCoverResponse.status} ${uploadCoverResponse.statusText}`,
      );
    }
    timings.uploadCoverTime = Date.now() - uploadCoverStartTime;
  }

  // Update keepalive status for upload phase
  sendEvent("keepalive", { status: "uploading" });

  // Upload rendered video
  const uploadStartTime = Date.now();
  const uploadResponse = await ffsFetch(upload.videoUrl, {
    method: "PUT",
    body: videoBuffer,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": videoBuffer.length.toString(),
    },
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `Failed to upload rendered video: ${uploadResponse.status} ${uploadResponse.statusText}`,
    );
  }
  timings.uploadTime = Date.now() - uploadStartTime;

  return timings;
}

/**
 * Internal render and upload logic
 * Returns timings for the SSE complete event
 */
export async function renderAndUploadInternal(
  effie: EffieData<EffieSources>,
  scale: number,
  upload: UploadOptions,
  sendEvent: SSEEventSender,
  ctx: ServerContext,
): Promise<Record<string, number>> {
  // Render effie data to video buffer
  const renderStartTime = Date.now();
  const { EffieRenderer } = await import("../render");
  const renderer = new EffieRenderer(effie, {
    transientStore: ctx.transientStore,
    httpProxy: ctx.httpProxy,
  });
  const videoStream = await renderer.render(scale);
  const chunks: Buffer[] = [];
  for await (const chunk of videoStream) {
    chunks.push(Buffer.from(chunk));
  }
  const videoBuffer = Buffer.concat(chunks);
  const renderTime = Date.now() - renderStartTime;

  // Upload video (and cover)
  const timings = await uploadRenderedVideo(
    videoBuffer,
    effie,
    upload,
    sendEvent,
  );
  timings.renderTime = renderTime;

  return timings;
}
