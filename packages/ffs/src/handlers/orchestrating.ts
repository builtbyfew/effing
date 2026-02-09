import express from "express";
import { randomUUID } from "crypto";
import type { Response as UndiciResponse } from "undici";
import { storeKeys } from "../storage";
import { ffsFetch } from "../fetch";
import { extractEffieSourcesWithTypes, effieDataSchema } from "@effing/effie";
import type { EffieData, EffieSources } from "@effing/effie";
import type {
  ServerContext,
  SSEEventSender,
  WarmupAndRenderJob,
  RenderJob,
  UploadOptions,
} from "./shared";
import {
  setupCORSHeaders,
  setupSSEResponse,
  createSSEEventSender,
} from "./shared";
import { warmupSources } from "./caching";
import { renderAndUploadInternal } from "./rendering";

/**
 * POST /warmup-and-render - Create a combined warmup and render job
 * Returns a job ID and URL for SSE streaming
 */
export async function createWarmupAndRenderJob(
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

    // Create IDs for warmup and render sub-jobs
    const jobId = randomUUID();
    const warmupJobId = randomUUID();
    const renderJobId = randomUUID();

    // Store the combined job
    const job: WarmupAndRenderJob = {
      effie,
      sources,
      scale,
      upload,
      warmupJobId,
      renderJobId,
      createdAt: Date.now(),
      metadata: options?.metadata,
    };

    await ctx.transientStore.putJson(
      storeKeys.warmupAndRenderJob(jobId),
      job,
      ctx.transientStore.jobDataTtlMs,
    );

    // Also store sub-jobs for backend execution
    await ctx.transientStore.putJson(
      storeKeys.warmupJob(warmupJobId),
      { sources, metadata: options?.metadata },
      ctx.transientStore.jobDataTtlMs,
    );
    await ctx.transientStore.putJson(
      storeKeys.renderJob(renderJobId),
      {
        effie,
        scale,
        upload,
        createdAt: Date.now(),
        metadata: options?.metadata,
      } satisfies RenderJob,
      ctx.transientStore.jobDataTtlMs,
    );

    res.json({
      id: jobId,
      url: `${ctx.baseUrl}/warmup-and-render/${jobId}`,
    });
  } catch (error) {
    console.error("Error creating warmup-and-render job:", error);
    res.status(500).json({ error: "Failed to create warmup-and-render job" });
  }
}

/**
 * GET /warmup-and-render/:id - Stream warmup and render progress via SSE
 * Orchestrates warmup (local or remote) followed by render (local or remote)
 */
export async function streamWarmupAndRenderJob(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
): Promise<void> {
  try {
    setupCORSHeaders(res);

    const jobId = req.params.id;
    const jobStoreKey = storeKeys.warmupAndRenderJob(jobId);
    const job =
      await ctx.transientStore.getJson<WarmupAndRenderJob>(jobStoreKey);
    // Only allow the job to run once
    ctx.transientStore.delete(jobStoreKey);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

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
      // Phase 1: Warmup
      if (warmupBackend) {
        // Proxy warmup from remote backend
        await proxyRemoteSSE(
          `${warmupBackend.baseUrl}/warmup/${job.warmupJobId}`,
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

      if (renderBackend) {
        // Proxy render from remote backend
        await proxyRemoteSSE(
          `${renderBackend.baseUrl}/render/${job.renderJobId}`,
          sendEvent,
          "render:",
          res,
          renderBackend.apiKey
            ? { Authorization: `Bearer ${renderBackend.apiKey}` }
            : undefined,
        );
      } else {
        // Local render execution
        const renderSender = prefixEventSender(sendEvent, "render:");

        if (job.upload) {
          // Upload mode: render and upload, emit SSE events
          renderSender("started", { status: "rendering" });
          const timings = await renderAndUploadInternal(
            job.effie,
            job.scale,
            job.upload,
            renderSender,
            ctx,
          );
          renderSender("complete", { status: "uploaded", timings });
        } else {
          // Non-upload mode: return URL to existing render job
          const videoUrl = `${ctx.baseUrl}/render/${job.renderJobId}`;
          sendEvent("complete", { status: "ready", videoUrl });
        }
      }

      // Final complete event (only for upload mode, non-upload already sent complete)
      if (job.upload && !renderBackend) {
        sendEvent("complete", { status: "done" });
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
    console.error("Error in warmup-and-render streaming:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Warmup-and-render streaming failed" });
    } else {
      res.end();
    }
  }
}

/**
 * Create a prefixed event sender that adds a prefix to event names
 */
export function prefixEventSender(
  sendEvent: SSEEventSender,
  prefix: string,
): SSEEventSender {
  return (event: string, data: object) => {
    sendEvent(`${prefix}${event}`, data);
  };
}

/**
 * Proxy SSE events from a remote backend, prefixing event names
 */
export async function proxyRemoteSSE(
  url: string,
  sendEvent: SSEEventSender,
  prefix: string,
  res: express.Response,
  headers?: Record<string, string>,
): Promise<void> {
  const response = await ffsFetch(url, {
    headers: {
      Accept: "text/event-stream",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Remote backend error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body from remote backend");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Check if client disconnected
      if (res.destroyed) {
        reader.cancel();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6);
        } else if (line === "" && currentEvent && currentData) {
          // End of event, forward it with prefix
          try {
            const data = JSON.parse(currentData);
            sendEvent(`${prefix}${currentEvent}`, data);
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
  }
}

/**
 * Proxy a binary stream (e.g., video) from a fetch Response to an Express response.
 * Forwards Content-Type and Content-Length headers.
 */
export async function proxyBinaryStream(
  response: UndiciResponse,
  res: express.Response,
): Promise<void> {
  const contentType = response.headers.get("content-type");
  if (contentType) res.set("Content-Type", contentType);

  const contentLength = response.headers.get("content-length");
  if (contentLength) res.set("Content-Length", contentLength);

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (res.destroyed) {
        reader.cancel();
        break;
      }

      res.write(value);
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}
