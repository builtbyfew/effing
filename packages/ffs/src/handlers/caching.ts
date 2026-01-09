import express from "express";
import { Readable, Transform } from "stream";
import { randomUUID } from "crypto";
import { cacheKeys } from "../cache";
import { ffsFetch } from "../fetch";
import { extractEffieSources } from "@effing/effie";
import type { ServerContext, SSEEventSender, WarmupJob } from "./shared";
import {
  parseEffieData,
  setupCORSHeaders,
  setupSSEResponse,
  createSSEEventSender,
} from "./shared";

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

    const sources = extractEffieSources(parseResult.effie);
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
 * Warm up sources by fetching and caching them
 */
export async function warmupSources(
  sources: string[],
  sendEvent: SSEEventSender,
  ctx: ServerContext,
): Promise<void> {
  const total = sources.length;
  const sourceCacheKeys = sources.map(cacheKeys.source);

  sendEvent("start", { total });

  // Check what's already cached
  const existsMap = await ctx.cacheStorage.existsMany(sourceCacheKeys);

  let cached = 0;
  let failed = 0;

  // Report hits immediately
  for (let i = 0; i < sources.length; i++) {
    if (existsMap.get(sourceCacheKeys[i])) {
      cached++;
      sendEvent("progress", {
        url: sources[i],
        status: "hit",
        cached,
        failed,
        total,
      });
    }
  }

  // Filter to uncached sources
  const uncached = sources.filter((_, i) => !existsMap.get(sourceCacheKeys[i]));

  if (uncached.length === 0) {
    sendEvent("summary", { cached, failed, total });
    return;
  }

  // Keepalive interval for long-running fetches
  const keepalive = setInterval(() => {
    sendEvent("keepalive", { cached, failed, total });
  }, 25_000);

  // Fetch uncached sources with concurrency limit
  const queue = [...uncached];
  const workers = Array.from(
    { length: Math.min(ctx.cacheConcurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const url = queue.shift()!;
        const cacheKey = cacheKeys.source(url);
        const startTime = Date.now();

        try {
          // Check if another worker is already fetching this
          let fetchPromise = inFlightFetches.get(cacheKey);
          if (!fetchPromise) {
            fetchPromise = fetchAndCache(url, cacheKey, sendEvent, ctx);
            inFlightFetches.set(cacheKey, fetchPromise);
          }

          await fetchPromise;
          inFlightFetches.delete(cacheKey);

          cached++;
          sendEvent("progress", {
            url,
            status: "cached",
            cached,
            failed,
            total,
            ms: Date.now() - startTime,
          });
        } catch (error) {
          inFlightFetches.delete(cacheKey);
          failed++;
          sendEvent("progress", {
            url,
            status: "error",
            error: String(error),
            cached,
            failed,
            total,
            ms: Date.now() - startTime,
          });
        }
      }
    },
  );

  await Promise.all(workers);
  clearInterval(keepalive);

  sendEvent("summary", { cached, failed, total });
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
