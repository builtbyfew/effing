import express from "express";
import type { Response as UndiciResponse } from "undici";
import type { TransientStore } from "../storage";
import { createTransientStore } from "../storage";
import { HttpProxy } from "../proxy";
import { ffsFetch } from "../fetch";
import type { TypedEventSender, EventSender } from "../sse";
export type { EventSender } from "../sse";
import type {
  EffieData,
  EffieSources,
  EffieSourceWithType,
} from "@effing/effie";
import { effieDataSchema } from "@effing/effie";
import { ErrorCode } from "./errors";
import type { ErrorCode as ErrorCodeType } from "./errors";

export type OnRenderComplete = (result: {
  effie: EffieData<EffieSources>;
  metadata?: Record<string, unknown>;
  wallClockTime: number;
}) => void | Promise<void>;

export type UploadOptions = {
  videoUrl: string;
  coverUrl?: string;
};

export type BackendConfig = {
  baseUrl: string;
  apiKey?: string;
};

export type WarmupBackendResolver = (
  sources: EffieSourceWithType[],
  metadata?: Record<string, unknown>,
) => BackendConfig | null;

export type RenderBackendResolver = (
  effie: EffieData<EffieSources>,
  metadata?: Record<string, unknown>,
) => BackendConfig | null;

export type WarmupJob = {
  sources: EffieSourceWithType[];
  metadata?: Record<string, unknown>;
};

export type ResolvedRenderJob = {
  kind: "resolved";
  effie: EffieData<EffieSources>;
  sources: EffieSourceWithType[];
  scale: number;
  upload?: UploadOptions;
  purge?: boolean;
  warmupJobId: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

export type DeferredRenderJob = {
  kind: "deferred";
  effieUrl: string;
  scale: number;
  upload?: UploadOptions;
  purge?: boolean;
  warmupJobId: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

export type RenderJob = ResolvedRenderJob | DeferredRenderJob;

export type VideoJob = {
  effie: EffieData<EffieSources>;
  scale: number;
  metadata?: Record<string, unknown>;
};

export type ServerContext = {
  transientStore: TransientStore;
  httpProxy?: HttpProxy;
  baseUrl: string;
  skipValidation: boolean;
  warmupConcurrency: number;
  warmupBackendResolver?: WarmupBackendResolver;
  renderBackendResolver?: RenderBackendResolver;
  onRenderComplete?: OnRenderComplete;
};

export type ParseEffieResult =
  | { effie: EffieData<EffieSources> }
  | {
      error: string;
      code: ErrorCodeType;
      issues?: Array<{ path: string; message: string }>;
    };

/**
 * Create the server context with configuration from environment variables
 */
export async function createServerContext(options?: {
  warmupBackendResolver?: WarmupBackendResolver;
  renderBackendResolver?: RenderBackendResolver;
  httpProxy?: boolean;
  onRenderComplete?: OnRenderComplete;
}): Promise<ServerContext> {
  const port = process.env.FFS_PORT || process.env.PORT || 2000;
  const enableHttpProxy = options?.httpProxy ?? true;
  let httpProxy: HttpProxy | undefined;
  if (enableHttpProxy) {
    httpProxy = new HttpProxy();
    await httpProxy.start();
  }
  return {
    transientStore: createTransientStore(),
    httpProxy,
    baseUrl: process.env.FFS_BASE_URL || `http://localhost:${port}`,
    skipValidation:
      !!process.env.FFS_SKIP_VALIDATION &&
      process.env.FFS_SKIP_VALIDATION !== "false",
    warmupConcurrency: parseInt(process.env.FFS_WARMUP_CONCURRENCY || "4", 10),
    warmupBackendResolver: options?.warmupBackendResolver,
    renderBackendResolver: options?.renderBackendResolver,
    onRenderComplete: options?.onRenderComplete,
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
        code: ErrorCode.INVALID_EFFIE,
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
      return {
        error: "Invalid effie data: missing segments",
        code: ErrorCode.INVALID_EFFIE,
      };
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
export function createEventSender(res: express.Response): EventSender;
export function createEventSender<TMap extends Record<string, unknown>>(
  res: express.Response,
): TypedEventSender<TMap>;
export function createEventSender(res: express.Response): EventSender {
  return (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

/**
 * Create a prefixed event sender that adds a prefix to event names
 */
export function prefixEventSender<TMap extends Record<string, unknown>>(
  sendEvent: EventSender,
  prefix: string,
): TypedEventSender<TMap> {
  return ((event: string, data: object) => {
    sendEvent(`${prefix}${event}`, data);
  }) as TypedEventSender<TMap>;
}

/**
 * Proxy SSE events from a remote backend, prefixing event names
 */
export async function proxyRemoteSSE(
  url: string,
  sendEvent: EventSender,
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
  let currentEvent = "";
  let currentData = "";

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
