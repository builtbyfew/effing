import express from "express";
import type { CacheStorage } from "../cache";
import { createCacheStorage } from "../cache";
import type {
  EffieData,
  EffieSources,
  EffieSourceWithType,
} from "@effing/effie";
import { effieDataSchema } from "@effing/effie";

export type UploadOptions = {
  videoUrl: string;
  coverUrl?: string;
};

export type WarmupJob = {
  sources: EffieSourceWithType[];
};

export type RenderJob = {
  effie: EffieData<EffieSources>;
  scale: number;
  upload?: UploadOptions;
  createdAt: number;
};

export type ServerContext = {
  cacheStorage: CacheStorage;
  baseUrl: string;
  skipValidation: boolean;
  cacheConcurrency: number;
};

export type SSEEventSender = (event: string, data: object) => void;

export type ParseEffieResult =
  | { effie: EffieData<EffieSources> }
  | { error: string; issues?: object[] };

/**
 * Create the server context with configuration from environment variables
 */
export function createServerContext(): ServerContext {
  const port = process.env.FFS_PORT || 2000;
  return {
    cacheStorage: createCacheStorage(),
    baseUrl: process.env.FFS_BASE_URL || `http://localhost:${port}`,
    skipValidation:
      !!process.env.FFS_SKIP_VALIDATION &&
      process.env.FFS_SKIP_VALIDATION !== "false",
    cacheConcurrency: parseInt(process.env.FFS_CACHE_CONCURRENCY || "4", 10),
  };
}

/**
 * Parse and validate Effie data from request body
 */
export function parseEffieData(
  body: unknown,
  skipValidation: boolean,
): ParseEffieResult {
  // Wrapped format has `effie` property
  const isWrapped =
    typeof body === "object" && body !== null && "effie" in body;
  const rawEffieData = isWrapped ? (body as { effie: unknown }).effie : body;

  if (!skipValidation) {
    const result = effieDataSchema.safeParse(rawEffieData);
    if (!result.success) {
      return {
        error: "Invalid effie data",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }
    return { effie: result.data };
  } else {
    const effie = rawEffieData as EffieData<EffieSources>;
    if (!effie?.segments) {
      return { error: "Invalid effie data: missing segments" };
    }
    return { effie };
  }
}

/**
 * Set up CORS headers for public endpoints
 */
export function setupCORSHeaders(res: express.Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
}

/**
 * Set up SSE response headers
 */
export function setupSSEResponse(res: express.Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

/**
 * Create an SSE event sender function for a response
 */
export function createSSEEventSender(res: express.Response): SSEEventSender {
  return (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}
