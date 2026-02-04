import express from "express";
import { Readable, Transform } from "stream";
import { randomUUID } from "crypto";
import { cacheKeys } from "../cache";
import { ffsFetch } from "../fetch";
import {
  extractEffieSources,
  extractEffieSourcesWithTypes,
} from "@effing/effie";
import type { EffieSourceWithType } from "@effing/effie";
import type { ServerContext, SSEEventSender, WarmupJob } from "./shared";
import {
  parseEffieData,
  setupCORSHeaders,
  setupSSEResponse,
  createSSEEventSender,
} from "./shared";
import { proxyRemoteSSE } from "./orchestrating";

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
): Promise<void> {
  try {
    const parseResult = parseEffieData(req.body, ctx.skipValidation);
    if ("error" in parseResult) {
      res.status(400).json(parseResult);
      return;
    }

    const sources = extractEffieSourcesWithTypes(parseResult.effie);
    const jobId = randomUUID();

    // Store job in cache
    await ctx.cacheStorage.putJson(cacheKeys.warmupJob(jobId), { sources });

    res.json({
      id: jobId,
      url: `${ctx.baseUrl}/warmup/${jobId}`,
    });
  } catch (error) {
    console.error("Error creating warmup job:", error);
    res.status(500).json({ error: "Failed to create warmup job" });
  }
}

/**
 * GET /warmup/:id - Stream warmup progress via SSE
 * Fetches and caches sources, emitting progress events
 */
export async function streamWarmupJob(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
): Promise<void> {
  try {
    setupCORSHeaders(res);

    const jobId = req.params.id;

    // Proxy to warmup backend if configured
    if (ctx.warmupBackendBaseUrl) {
      setupSSEResponse(res);
      const sendEvent = createSSEEventSender(res);
      try {
        await proxyRemoteSSE(
          `${ctx.warmupBackendBaseUrl}/warmup/${jobId}`,
          sendEvent,
          "",
          res,
        );
      } finally {
        res.end();
      }
      return;
    }

    const jobCacheKey = cacheKeys.warmupJob(jobId);
    const job = await ctx.cacheStorage.getJson<WarmupJob>(jobCacheKey);
    // only allow the warmup job to run once
    ctx.cacheStorage.delete(jobCacheKey);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    setupSSEResponse(res);
    const sendEvent = createSSEEventSender(res);

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
      res.status(500).json({ error: "Warmup streaming failed" });
    } else {
      res.end();
    }
  }
}

/**
 * POST /purge - Purge cached sources for an Effie composition
 */
export async function purgeCache(
  req: express.Request,
  res: express.Response,
  ctx: ServerContext,
): Promise<void> {
  try {
    const parseResult = parseEffieData(req.body, ctx.skipValidation);
    if ("error" in parseResult) {
      res.status(400).json(parseResult);
      return;
    }

    const sources = extractEffieSources(parseResult.effie);

    let purged = 0;
    for (const url of sources) {
      const ck = cacheKeys.source(url);
      if (await ctx.cacheStorage.exists(ck)) {
        await ctx.cacheStorage.delete(ck);
        purged++;
      }
    }

    res.json({ purged, total: sources.length });
  } catch (error) {
    console.error("Error purging cache:", error);
    res.status(500).json({ error: "Failed to purge cache" });
  }
}

/**
 * Warm up sources by fetching and caching them.
 * HTTP(S) video/audio sources are skipped as they are passed directly to FFmpeg.
 */
export async function warmupSources(
  sources: EffieSourceWithType[],
  sendEvent: SSEEventSender,
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
  const sourceCacheKeys = sourcesToCache.map((s) => cacheKeys.source(s.url));
  const existsMap = await ctx.cacheStorage.existsMany(sourceCacheKeys);

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
    { length: Math.min(ctx.cacheConcurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const source = queue.shift()!;
        const cacheKey = cacheKeys.source(source.url);
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
  sendEvent: SSEEventSender,
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

  // Pipe through progress tracker to cache storage
  const trackedStream = sourceStream.pipe(progressStream);
  await ctx.cacheStorage.put(cacheKey, trackedStream);
}
