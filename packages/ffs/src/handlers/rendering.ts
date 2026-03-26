import express from "express";
import { randomUUID } from "crypto";
import { storeKeys } from "../storage";
import { ffsFetch } from "../fetch";
import {
  extractEffieSourcesWithTypes,
  extractEffieSources,
} from "@effing/effie";
import type { EffieData, EffieSources } from "@effing/effie";
import type { RenderEventMap, RenderEventSender, WarmupEventMap } from "../sse";
import type {
  ServerContext,
  RenderJob,
  ResolvedRenderJob,
  DeferredRenderJob,
  VideoJob,
  UploadOptions,
} from "./shared";
import {
  parseEffieData,
  setupCORSHeaders,
  setupSSEResponse,
  createEventSender,
  prefixEventSender,
  proxyRemoteSSE,
  proxyBinaryStream,
} from "./shared";
import { FetchError } from "../render";
import { warmupSources, purgeCachedSources } from "./caching";
import { sendError, ErrorCode, BackendError, backendError } from "./errors";
import type { ErrorCode as ErrorCodeType } from "./errors";

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function toErrorCode(error: unknown): ErrorCodeType {
  if (error instanceof BackendError) return error.code;
  return error instanceof FetchError
    ? ErrorCode.FETCH_FAILED
    : ErrorCode.INTERNAL_ERROR;
}

async function notifyRenderError(
  ctx: ServerContext,
  error: unknown,
  extra?: {
    effie?: EffieData<EffieSources>;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!ctx.onRenderError) return;
  try {
    await ctx.onRenderError({
      error: toError(error),
      code: toErrorCode(error),
      ...extra,
    });
  } catch (err) {
    console.error("onRenderError hook error:", err);
  }
}

/**
 * POST /render - Create a render job (warmup + render, optional purge)
 * Returns a job ID and progress URL for SSE streaming
 */
export async function createRenderJob(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
  options?: {
    metadata?: Record<string, unknown>;
    timings?: Record<string, number>;
  },
): Promise<void> {
  try {
    // Parse request body
    const body = req.body as Record<string, unknown>;

    const scale =
      (body.scale as number | undefined) ??
      (req.query?.scale ? parseFloat(req.query.scale as string) : undefined) ??
      1;
    const purge =
      (body.purge as boolean | undefined) ??
      (req.query?.purge === "true" ? true : undefined) ??
      false;
    const upload = body.upload as UploadOptions | undefined;

    // Create IDs
    const jobId = randomUUID();
    const warmupJobId = randomUUID();

    // URL handling: defer fetch to progress stream
    if (typeof body.effie === "string") {
      const job: DeferredRenderJob = {
        kind: "deferred",
        effieUrl: body.effie,
        scale,
        upload,
        purge,
        warmupJobId,
        createdAt: Date.now(),
        metadata: options?.metadata,
      };

      const storeJobStart = performance.now();
      await ctx.transientStore.putJson(
        storeKeys.renderJob(jobId),
        job,
        ctx.transientStore.ttlMs,
      );
      if (options?.timings) {
        options.timings.storeJob = performance.now() - storeJobStart;
      }

      res.json({
        id: jobId,
        progressUrl: `${ctx.baseUrl}/render/${jobId}/progress`,
      });
      return;
    }

    // Parse & validate effie data (supports both wrapped and raw formats)
    const validationStart = performance.now();
    const parseResult = parseEffieData(body, ctx.skipValidation);
    if (options?.timings) {
      options.timings.validation = performance.now() - validationStart;
    }
    if ("error" in parseResult) {
      sendError(
        res,
        400,
        parseResult.code,
        parseResult.error,
        parseResult.issues,
      );
      return;
    }
    const effie = parseResult.effie;

    const sources = extractEffieSourcesWithTypes(effie);

    // Store the render job
    const job: ResolvedRenderJob = {
      kind: "resolved",
      effie,
      sources,
      scale,
      upload,
      purge,
      warmupJobId,
      createdAt: Date.now(),
      metadata: options?.metadata,
    };

    const storeJobStart = performance.now();
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
    if (options?.timings) {
      options.timings.storeJob = performance.now() - storeJobStart;
    }

    res.json({
      id: jobId,
      progressUrl: `${ctx.baseUrl}/render/${jobId}/progress`,
    });
  } catch (error) {
    console.error("Error creating render job:", error);
    sendError(
      res,
      500,
      ErrorCode.INTERNAL_ERROR,
      "Failed to create render job",
    );
  }
}

/**
 * Resolve a deferred Effie URL: fetch, parse, validate, extract sources.
 * Emits effie:fetching/effie:fetched SSE events. Throws on failure.
 */
async function resolveEffieUrl(
  deferred: DeferredRenderJob,
  sendEvent: ReturnType<typeof createEventSender<RenderEventMap>>,
  ctx: ServerContext,
): Promise<ResolvedRenderJob> {
  const url = deferred.effieUrl;
  sendEvent("effie:fetching", { url });

  let response;
  try {
    response = await ffsFetch(url);
  } catch (error) {
    throw new Error(
      `Failed to fetch Effie data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Effie data: ${response.status} ${response.statusText}`,
    );
  }

  const body = { effie: await response.json() };
  const parseResult = parseEffieData(body, ctx.skipValidation);
  if ("error" in parseResult) {
    throw new Error(parseResult.error);
  }

  const effie = parseResult.effie;
  const sources = extractEffieSourcesWithTypes(effie);

  sendEvent("effie:fetched", { url });

  return {
    kind: "resolved",
    effie,
    sources,
    scale: deferred.scale,
    upload: deferred.upload,
    purge: deferred.purge,
    warmupJobId: deferred.warmupJobId,
    createdAt: deferred.createdAt,
    metadata: deferred.metadata,
  };
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
    const storedJob = await ctx.transientStore.getJson<RenderJob>(jobStoreKey);

    if (!storedJob) {
      sendError(res, 404, ErrorCode.NOT_FOUND, "Job not found");
      return;
    }

    // Only allow the job to run once
    ctx.transientStore.delete(jobStoreKey);

    setupSSEResponse(res);
    const sendEvent = createEventSender<RenderEventMap>(res);
    const rawSendEvent = createEventSender(res);

    // Keepalive interval for long-running operations
    let keepalivePhase: "effie" | "warmup" | "render" | "upload" =
      storedJob.kind === "deferred" ? "effie" : "warmup";
    const keepalive = setInterval(() => {
      sendEvent("keepalive", { phase: keepalivePhase });
    }, 25_000);

    let job: ResolvedRenderJob | undefined;
    try {
      // Phase -1: Resolve deferred Effie URL if needed
      // Backward compat: jobs without `kind` (from before deploy) are treated as resolved
      if (storedJob.kind === "deferred") {
        job = await resolveEffieUrl(storedJob, sendEvent, ctx);

        // Store warmup sub-job now that we have sources
        await ctx.transientStore.putJson(
          storeKeys.warmupJob(job.warmupJobId),
          { sources: job.sources, metadata: job.metadata },
          ctx.transientStore.ttlMs,
        );

        keepalivePhase = "warmup";
      } else {
        // resolved or legacy (no kind field)
        job = storedJob as ResolvedRenderJob;
      }

      // Resolve backends up front
      const warmupBackend = ctx.warmupBackendResolver
        ? ctx.warmupBackendResolver(job.sources, job.metadata)
        : null;
      const renderBackend = ctx.renderBackendResolver
        ? ctx.renderBackendResolver(job.effie, job.metadata)
        : null;

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
          rawSendEvent,
          "warmup:",
          res,
          warmupBackend.apiKey
            ? { Authorization: `Bearer ${warmupBackend.apiKey}` }
            : undefined,
        );
      } else {
        // Local warmup execution
        const warmupSender = prefixEventSender<WarmupEventMap>(
          rawSendEvent,
          "warmup:",
        );
        await warmupSources(job.sources, warmupSender, ctx);
        warmupSender("complete", { status: "ready" });
      }

      // Phase 2: Render
      keepalivePhase = "render";

      if (job.upload) {
        keepalivePhase = "upload";
        const renderStart = performance.now();
        if (renderBackend) {
          // Upload + backend: store VideoJob for backend to render,
          // fetch binary video from backend, upload locally.
          const videoJob: VideoJob = {
            effie: job.effie,
            scale: job.scale,
            metadata: job.metadata,
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
            throw await backendError(response);
          }
          const videoBuffer = Buffer.from(await response.arrayBuffer());

          const timings = await uploadRenderedVideo(
            videoBuffer,
            job.effie,
            job.upload,
            sendEvent,
          );
          sendEvent(
            "render:complete",
            timings as RenderEventMap["render:complete"],
          );
        } else {
          // Upload + no backend: render and upload locally (no VideoJob stored)
          const timings = await renderAndUploadInternal(
            job.effie,
            job.scale,
            job.upload,
            sendEvent,
            ctx,
          );
          sendEvent(
            "render:complete",
            timings as RenderEventMap["render:complete"],
          );
        }

        if (ctx.onRenderComplete) {
          try {
            await ctx.onRenderComplete({
              effie: job.effie,
              metadata: job.metadata,
              wallClockTime: performance.now() - renderStart,
            });
          } catch (err) {
            console.error("onRenderComplete hook error:", err);
          }
        }

        sendEvent("complete", { status: "done" });
      } else {
        // Non-upload mode: store VideoJob for on-demand fetch via /render/:id/video
        const videoJob: VideoJob = {
          effie: job.effie,
          scale: job.scale,
          metadata: job.metadata,
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
        message: toError(error).message,
        code: toErrorCode(error),
      });
      await notifyRenderError(ctx, error, {
        effie: job?.effie,
        metadata: job?.metadata ?? storedJob.metadata,
      });
    } finally {
      clearInterval(keepalive);
      res.end();
    }
  } catch (error) {
    console.error("Error in render progress streaming:", error);
    await notifyRenderError(ctx, error);
    if (!res.headersSent) {
      sendError(
        res,
        500,
        ErrorCode.INTERNAL_ERROR,
        "Render progress streaming failed",
      );
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
  let videoJob: VideoJob | null | undefined;
  try {
    setupCORSHeaders(res);

    const jobId = req.params.id;
    const videoJobKey = storeKeys.videoJob(jobId);
    videoJob = await ctx.transientStore.getJson<VideoJob>(videoJobKey);

    if (!videoJob) {
      sendError(res, 404, ErrorCode.NOT_FOUND, "Video not found or expired");
      return;
    }

    // Proxy to render backend if resolver is configured
    // Don't delete — the backend reads/deletes the VideoJob from shared store
    if (ctx.renderBackendResolver) {
      const backend = ctx.renderBackendResolver(
        videoJob.effie,
        videoJob.metadata,
      );
      if (backend) {
        const renderStart = performance.now();
        const backendUrl = `${backend.baseUrl}/render/${jobId}/video`;
        const response = await ffsFetch(backendUrl, {
          headers: backend.apiKey
            ? { Authorization: `Bearer ${backend.apiKey}` }
            : undefined,
        });

        if (!response.ok) {
          const err = await backendError(response);
          sendError(res, err.status, err.code, err.message);
          return;
        }

        await proxyBinaryStream(response, res);

        if (ctx.onRenderComplete) {
          try {
            await ctx.onRenderComplete({
              effie: videoJob.effie,
              metadata: videoJob.metadata,
              wallClockTime: performance.now() - renderStart,
            });
          } catch (err) {
            console.error("onRenderComplete hook error:", err);
          }
        }
        return;
      }
    }

    // Local render — safe to delete the video job (one-time use)
    ctx.transientStore.delete(videoJobKey);

    // Render locally
    await streamRenderDirect(res, videoJob, ctx);
  } catch (error) {
    console.error("Error streaming video:", error);
    await notifyRenderError(ctx, error, {
      effie: videoJob?.effie,
      metadata: videoJob?.metadata,
    });
    if (!res.headersSent) {
      if (error instanceof FetchError) {
        sendError(res, 422, ErrorCode.FETCH_FAILED, error.message);
      } else {
        sendError(res, 500, ErrorCode.INTERNAL_ERROR, "Video streaming failed");
      }
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
  const renderStart = performance.now();
  const { EffieRenderer } = await import("../render");
  const renderer = new EffieRenderer(job.effie, {
    transientStore: ctx.transientStore,
    httpProxy: ctx.httpProxy,
  });

  try {
    const videoStream = await renderer.render(job.scale);

    res.on("close", () => {
      videoStream.destroy();
    });

    res.set("Content-Type", "video/mp4");
    res.set("Cache-Control", "public, immutable, max-age=86400");

    await new Promise<void>((resolve, reject) => {
      videoStream.pipe(res);
      res.on("finish", resolve);
      res.on("error", reject);
    });
  } finally {
    renderer.close();
  }

  if (ctx.onRenderComplete) {
    try {
      await ctx.onRenderComplete({
        effie: job.effie,
        metadata: job.metadata,
        wallClockTime: performance.now() - renderStart,
      });
    } catch (err) {
      console.error("onRenderComplete hook error:", err);
    }
  }
}

/**
 * Upload a rendered video buffer (and optional cover) to presigned URLs.
 * Shared between local render+upload and backend render+upload flows.
 */
async function uploadRenderedVideo(
  videoBuffer: Buffer,
  effie: EffieData<EffieSources>,
  upload: UploadOptions,
  sendEvent: RenderEventSender,
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
  sendEvent("keepalive", { phase: "upload" });

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
  sendEvent: RenderEventSender,
  ctx: ServerContext,
): Promise<Record<string, number>> {
  // Render effie data to video buffer
  const renderStartTime = Date.now();
  const { EffieRenderer } = await import("../render");
  const renderer = new EffieRenderer(effie, {
    transientStore: ctx.transientStore,
    httpProxy: ctx.httpProxy,
  });
  try {
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
  } finally {
    renderer.close();
  }
}
