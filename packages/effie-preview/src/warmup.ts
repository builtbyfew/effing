import type { WarmupEventMap } from "@effing/ffs/sse";

// ============ Types ============

/**
 * Union of all warmup SSE event types, derived from the server-side
 * `WarmupEventMap` so the client stays in sync automatically.
 * Each variant is `{ type: K; data: WarmupEventMap[K] }`.
 */
export type EffieWarmupEvent = {
  [K in keyof WarmupEventMap & string]: { type: K; data: WarmupEventMap[K] };
}[keyof WarmupEventMap & string];

/** Current warmup state */
export type EffieWarmupState = {
  status: "idle" | "connecting" | "warming" | "ready" | "error";
  total: number;
  cached: number;
  failed: number;
  skipped: number;
  downloading: Map<string, { url: string; bytesReceived: number }>;
  error?: string;
  startTime?: number;
  endTime?: number;
};

// ============ SSE Connection ============

/**
 * Connects to an SSE warmup stream and calls onEvent for each event.
 * Returns a cleanup function to close the connection.
 *
 * @param streamUrl - Full URL to the warmup SSE endpoint
 * @param onEvent - Callback for each SSE event
 */
export function connectEffieWarmupStream(
  streamUrl: string,
  onEvent: (event: EffieWarmupEvent) => void,
): () => void {
  const eventSource = new EventSource(streamUrl);

  eventSource.addEventListener("start", (e) => {
    onEvent({ type: "start", data: JSON.parse((e as MessageEvent).data) });
  });

  eventSource.addEventListener("progress", (e) => {
    onEvent({ type: "progress", data: JSON.parse((e as MessageEvent).data) });
  });

  eventSource.addEventListener("downloading", (e) => {
    onEvent({
      type: "downloading",
      data: JSON.parse((e as MessageEvent).data),
    });
  });

  eventSource.addEventListener("keepalive", (e) => {
    onEvent({ type: "keepalive", data: JSON.parse((e as MessageEvent).data) });
  });

  eventSource.addEventListener("summary", (e) => {
    onEvent({ type: "summary", data: JSON.parse((e as MessageEvent).data) });
  });

  eventSource.addEventListener("complete", (e) => {
    onEvent({ type: "complete", data: JSON.parse((e as MessageEvent).data) });
    eventSource.close();
  });

  eventSource.addEventListener("error", () => {
    onEvent({
      type: "error",
      data: { message: "Connection lost", code: "CONNECTION_LOST" },
    });
    eventSource.close();
  });

  return () => eventSource.close();
}
