import express from "express";
import { randomUUID } from "crypto";
import { storeKeys } from "../storage";
import { ffsFetch } from "../fetch";
import { effieDataSchema } from "@effing/effie";
import type { EffieData, EffieSources } from "@effing/effie";
import type {
  ServerContext,
  SSEEventSender,
  BackendConfig,
  RenderJob,
  UploadOptions,
} from "./shared";
import {
  setupCORSHeaders,
  setupSSEResponse,
  createSSEEventSender,
} from "./shared";
import { proxyBinaryStream } from "./orchestrating";

/**
 * POST /render - Create a render job
 * Returns a job ID and URL for streaming the rendered video
 */
export async function createRenderJob(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
  options?: { metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    // Wrapped format has `effie` property,
    // otherwise it's just raw EffieData (which doesn't have an `effie` property)
    const isWrapped = "effie" in req.body;

    let rawEffieData: unknown;
    let scale: number;
    let upload: UploadOptions | undefined;

    if (isWrapped) {
      // Wrapped format: { effie: EffieData | string, scale?, upload? }
      const options = req.body as {
        effie: unknown;
        scale?: number;
        upload?: UploadOptions;
      };

      if (typeof options.effie === "string") {
        // Effie is a string, so it's a URL to fetch the EffieData from
        const response = await ffsFetch(options.effie);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch Effie data: ${response.status} ${response.statusText}`,
          );
        }
        rawEffieData = await response.json();
      } else {
        // Effie is an EffieData object
        rawEffieData = options.effie;
      }

      scale = options.scale ?? 1;
      upload = options.upload;
    } else {
      // Body is the EffieData, options in query params
      rawEffieData = req.body;
      scale = parseFloat(req.query.scale?.toString() || "1");
    }

    // Validate/parse effie data (validation can be disabled by setting FFS_SKIP_VALIDATION)
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
      // Minimal validation when schema validation is disabled
      const data = rawEffieData as EffieData<EffieSources>;
      if (!data?.segments) {
        res.status(400).json({ error: "Invalid effie data: missing segments" });
        return;
      }
      effie = data;
    }

    // Create render job
    const jobId = randomUUID();
    const job: RenderJob = {
      effie,
      scale,
      upload,
      createdAt: Date.now(),
      metadata: options?.metadata,
    };

    await ctx.transientStore.putJson(
      storeKeys.renderJob(jobId),
      job,
      ctx.transientStore.jobDataTtlMs,
    );

    res.json({
      id: jobId,
      url: `${ctx.baseUrl}/render/${jobId}`,
    });
  } catch (error) {
    console.error("Error creating render job:", error);
    res.status(500).json({ error: "Failed to create render job" });
  }
}

/**
 * GET /render/:id - Execute render job
 * Streams video directly (no upload) or SSE progress events (with upload)
 */
export async function streamRenderJob(
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
      res.status(404).json({ error: "Job not found or expired" });
      return;
    }

    // Proxy to render backend if resolver is configured
    if (ctx.renderBackendResolver) {
      const backend = ctx.renderBackendResolver(job.effie, job.metadata);
      if (backend) {
        await proxyRenderFromBackend(res, jobId, backend);
        return;
      }
    }

    // Render locally — only allow the render job to run once
    ctx.transientStore.delete(jobStoreKey);

    // Dispatch based on upload mode
    if (job.upload) {
      await streamRenderWithUpload(res, job, ctx);
    } else {
      await streamRenderDirect(res, job, ctx);
    }
  } catch (error) {
    console.error("Error in render:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Rendering failed" });
    } else {
      res.end();
    }
  }
}

/**
 * Stream video directly to the response (no upload)
 */
export async function streamRenderDirect(
  res: express.Response,
  job: RenderJob,
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
 * Render and upload, streaming SSE progress events
 */
export async function streamRenderWithUpload(
  res: express.Response,
  job: RenderJob,
  ctx: ServerContext,
): Promise<void> {
  setupSSEResponse(res);
  const sendEvent = createSSEEventSender(res);

  // Keepalive interval for long-running renders
  const keepalive = setInterval(() => {
    sendEvent("keepalive", { status: "rendering" });
  }, 25_000);

  try {
    sendEvent("started", { status: "rendering" });

    const timings = await renderAndUploadInternal(
      job.effie,
      job.scale,
      job.upload!,
      sendEvent,
      ctx,
    );

    sendEvent("complete", { status: "uploaded", timings });
  } catch (error) {
    sendEvent("error", { message: String(error) });
  } finally {
    clearInterval(keepalive);
    res.end();
  }
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
  const timings: Record<string, number> = {};

  // Fetch and upload cover if coverUrl provided
  if (upload.coverUrl) {
    const fetchCoverStartTime = Date.now();
    const coverFetchResponse = await ffsFetch(effie.cover);
    if (!coverFetchResponse.ok) {
      throw new Error(
        `Failed to fetch cover image: ${coverFetchResponse.status} ${coverFetchResponse.statusText}`,
      );
    }
    const coverBuffer = Buffer.from(await coverFetchResponse.arrayBuffer());
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

  // Render effie data to video
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
  timings.renderTime = Date.now() - renderStartTime;

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
 * Proxy render from backend based on Content-Type.
 * SSE (upload mode) uses proxyRemoteSSE, video stream uses proxyBinaryStream.
 */
async function proxyRenderFromBackend(
  res: express.Response,
  jobId: string,
  backend: BackendConfig,
): Promise<void> {
  const backendUrl = `${backend.baseUrl}/render/${jobId}`;
  const response = await ffsFetch(backendUrl, {
    headers: backend.apiKey
      ? { Authorization: `Bearer ${backend.apiKey}` }
      : undefined,
  });

  if (!response.ok) {
    res.status(response.status).json({ error: "Backend render failed" });
    return;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    // Upload mode: proxy SSE events
    setupSSEResponse(res);
    const sendEvent = createSSEEventSender(res);

    const reader = response.body?.getReader();
    if (!reader) {
      sendEvent("error", { message: "No response body from backend" });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (res.destroyed) {
          reader.cancel();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6);
          } else if (line === "" && currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData);
              sendEvent(currentEvent, data);
            } catch {
              // Skip malformed JSON
            }
            currentEvent = "";
            currentData = "";
          }
        }
      }
    } finally {
      reader.releaseLock();
      res.end();
    }
  } else {
    // Non-upload mode: proxy binary video stream
    await proxyBinaryStream(response, res);
  }
}
