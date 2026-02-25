import express from "express";
import { Readable, Transform } from "stream";
import { randomUUID } from "crypto";
import type { TransientStore } from "../storage";
import { storeKeys } from "../storage";
import { ffsFetch } from "../fetch";
import {
  extractEffieSources,
  extractEffieSourcesWithTypes,
} from "@effing/effie";
import type { EffieSourceWithType } from "@effing/effie";
import type { WarmupEventMap, WarmupEventSender } from "../sse";
import type { ServerContext, WarmupJob } from "./shared";
import {
  parseEffieData,
  setupCORSHeaders,
  setupSSEResponse,
  createEventSender,
} from "./shared";
import { proxyRemoteSSE } from "./shared";
import { sendError, ErrorCode } from "./errors";

/**
 * Check if a source should be skipped during warmup.
 * Video/audio sources are passed directly to FFmpeg and don't need caching.
 */
function shouldSkipWarmup(source: EffieSourceWithType): boolean {
  return source.type === "video" || source.type === "audio";
}

// Track in-flight fetches to avoid duplicate fetches within the same instance
const inFlightFetches = new Map<string, Promise<void>>();

/**
 * POST /warmup - Create a warmup job
 * Stores the source list in cache and returns a job ID for SSE streaming
 */
export async function createWarmupJob(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
  options?: {
    metadata?: Record<string, unknown>;
    timings?: Record<string, number>;
  },
): Promise<void> {
  try {
    const validationStart = performance.now();
    const parseResult = parseEffieData(req.body, ctx.skipValidation);
    if (options?.timings) {
      options.timings.validation = performance.now() - validationStart;
    }
    if ("error" in parseResult) {
      res.status(400).json(parseResult);
      return;
    }

    const sources = extractEffieSourcesWithTypes(parseResult.effie);
    const jobId = randomUUID();

    const job: WarmupJob = { sources, metadata: options?.metadata };
    const storeJobStart = performance.now();
    await ctx.transientStore.putJson(
      storeKeys.warmupJob(jobId),
      job,
      ctx.transientStore.ttlMs,
    );
    if (options?.timings) {
      options.timings.storeJob = performance.now() - storeJobStart;
    }

    res.json({
      id: jobId,
      progressUrl: `${ctx.baseUrl}/warmup/${jobId}/progress`,
    });
  } catch (error) {
    console.error("Error creating warmup job:", error);
    sendError(
      res,
      500,
      ErrorCode.INTERNAL_ERROR,
      "Failed to create warmup job",
    );
  }
}

/**
 * GET /warmup/:id/progress - Stream warmup progress via SSE
 * Fetches and caches sources, emitting progress events
 */
export async function streamWarmupProgress(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
): Promise<void> {
  try {
    setupCORSHeaders(res);

    const jobId = req.params.id;

    const jobStoreKey = storeKeys.warmupJob(jobId);
    const job = await ctx.transientStore.getJson<WarmupJob>(jobStoreKey);

    if (!job) {
      sendError(res, 404, ErrorCode.NOT_FOUND, "Job not found");
      return;
    }

    // Proxy to warmup backend if resolver is configured
    if (ctx.warmupBackendResolver) {
      const backend = ctx.warmupBackendResolver(job.sources, job.metadata);
      if (backend) {
        setupSSEResponse(res);
        const sendEvent = createEventSender(res);
        try {
          await proxyRemoteSSE(
            `${backend.baseUrl}/warmup/${jobId}/progress`,
            sendEvent,
            "",
            res,
            backend.apiKey
              ? { Authorization: `Bearer ${backend.apiKey}` }
              : undefined,
          );
        } finally {
          res.end();
        }
        return;
      }
    }

    // Local warmup — only allow the warmup job to run once
    ctx.transientStore.delete(jobStoreKey);

    setupSSEResponse(res);
    const sendEvent = createEventSender<WarmupEventMap>(res);

    try {
      await warmupSources(job.sources, sendEvent, ctx);
      sendEvent("complete", { status: "ready" });
    } catch (error) {
      sendEvent("error", { message: String(error) });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("Error in warmup streaming:", error);
    if (!res.headersSent) {
      sendError(res, 500, ErrorCode.INTERNAL_ERROR, "Warmup streaming failed");
    } else {
      res.end();
    }
  }
}

/**
 * Purge cached sources by URL list.
 * Returns the number purged and total.
 */
export async function purgeCachedSources(
  urls: string[],
  store: TransientStore,
): Promise<{ purged: number; total: number }> {
  let purged = 0;
  for (const url of urls) {
    const ck = storeKeys.source(url);
    if (await store.exists(ck)) {
      await store.delete(ck);
      purged++;
    }
  }
  return { purged, total: urls.length };
}

/**
 * POST /purge - Purge cached sources for an Effie composition
 */
export async function purgeCache(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
  options?: { timings?: Record<string, number> },
): Promise<void> {
  try {
    const validationStart = performance.now();
    const parseResult = parseEffieData(req.body, ctx.skipValidation);
    if (options?.timings) {
      options.timings.validation = performance.now() - validationStart;
    }
    if ("error" in parseResult) {
      res.status(400).json(parseResult);
      return;
    }

    const sources = extractEffieSources(parseResult.effie);
    const purgeStart = performance.now();
    const result = await purgeCachedSources(sources, ctx.transientStore);
    if (options?.timings) {
      options.timings.purge = performance.now() - purgeStart;
    }

    res.json(result);
  } catch (error) {
    console.error("Error purging cache:", error);
    sendError(res, 500, ErrorCode.INTERNAL_ERROR, "Failed to purge cache");
  }
}

/**
 * Warm up sources by fetching and caching them.
 * HTTP(S) video/audio sources are skipped as they are passed directly to FFmpeg.
 */
export async function warmupSources(
  sources: EffieSourceWithType[],
  sendEvent: WarmupEventSender,
  ctx: ServerContext,
): Promise<void> {
  const total = sources.length;

  sendEvent("start", { total });

  let cached = 0;
  let failed = 0;
  let skipped = 0;

  // Separate sources that need caching from those that should be skipped
  const sourcesToCache: EffieSourceWithType[] = [];
  for (const source of sources) {
    if (shouldSkipWarmup(source)) {
      skipped++;
      sendEvent("progress", {
        url: source.url,
        status: "skipped",
        reason: "http-video-audio-passthrough",
        cached,
        failed,
        skipped,
        total,
      });
    } else {
      sourcesToCache.push(source);
    }
  }

  // Check what's already cached
  const sourceCacheKeys = sourcesToCache.map((s) => storeKeys.source(s.url));
  const existsMap = await ctx.transientStore.existsMany(sourceCacheKeys);

  // Report hits immediately
  for (let i = 0; i < sourcesToCache.length; i++) {
    if (existsMap.get(sourceCacheKeys[i])) {
      cached++;
      sendEvent("progress", {
        url: sourcesToCache[i].url,
        status: "hit",
        cached,
        failed,
        skipped,
        total,
      });
    }
  }

  // Filter to uncached sources
  const uncached = sourcesToCache.filter(
    (_, i) => !existsMap.get(sourceCacheKeys[i]),
  );

  if (uncached.length === 0) {
    sendEvent("summary", { cached, failed, skipped, total });
    return;
  }

  // Keepalive interval for long-running fetches
  const keepalive = setInterval(() => {
    sendEvent("keepalive", { cached, failed, skipped, total });
  }, 25_000);

  // Fetch uncached sources with concurrency limit
  const queue = [...uncached];
  const workers = Array.from(
    { length: Math.min(ctx.warmupConcurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const source = queue.shift()!;
        const cacheKey = storeKeys.source(source.url);
        const startTime = Date.now();

        try {
          // Check if another worker is already fetching this
          let fetchPromise = inFlightFetches.get(cacheKey);
          if (!fetchPromise) {
            fetchPromise = fetchAndCache(source.url, cacheKey, sendEvent, ctx);
            inFlightFetches.set(cacheKey, fetchPromise);
          }

          await fetchPromise;
          inFlightFetches.delete(cacheKey);

          cached++;
          sendEvent("progress", {
            url: source.url,
            status: "cached",
            cached,
            failed,
            skipped,
            total,
            ms: Date.now() - startTime,
          });
        } catch (error) {
          inFlightFetches.delete(cacheKey);
          failed++;
          sendEvent("progress", {
            url: source.url,
            status: "error",
            error: String(error),
            cached,
            failed,
            skipped,
            total,
            ms: Date.now() - startTime,
          });
        }
      }
    },
  );

  await Promise.all(workers);
  clearInterval(keepalive);

  sendEvent("summary", { cached, failed, skipped, total });
}

/**
 * Fetch a source and cache it, with streaming progress events
 */
export async function fetchAndCache(
  url: string,
  cacheKey: string,
  sendEvent: WarmupEventSender,
  ctx: ServerContext,
): Promise<void> {
  const response = await ffsFetch(url, {
    headersTimeout: 10 * 60 * 1000, // 10 minutes
    bodyTimeout: 20 * 60 * 1000, // 20 minutes
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  sendEvent("downloading", { url, status: "started", bytesReceived: 0 });

  // Stream through a progress tracker
  const sourceStream = Readable.fromWeb(
    response.body as import("stream/web").ReadableStream,
  );

  let totalBytes = 0;
  let lastEventTime = Date.now();
  const PROGRESS_INTERVAL = 10_000; // 10 seconds

  const progressStream = new Transform({
    transform(chunk, _encoding, callback) {
      totalBytes += chunk.length;
      const now = Date.now();
      if (now - lastEventTime >= PROGRESS_INTERVAL) {
        sendEvent("downloading", {
          url,
          status: "downloading",
          bytesReceived: totalBytes,
        });
        lastEventTime = now;
      }
      callback(null, chunk);
    },
  });

  // Pipe through progress tracker to cache storage with source TTL
  const trackedStream = sourceStream.pipe(progressStream);
  await ctx.transientStore.put(
    cacheKey,
    trackedStream,
    ctx.transientStore.ttlMs,
  );
}
