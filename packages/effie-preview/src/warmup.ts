// ============ Types ============

/** Progress event when a source is processed */
export type EffieWarmupProgressEvent = {
  url: string;
  status: "hit" | "cached" | "error";
  cached: number;
  failed: number;
  total: number;
  ms?: number;
  error?: string;
};

/** Downloading event during source fetch */
export type EffieWarmupDownloadingEvent = {
  url: string;
  status: "started" | "downloading";
  bytesReceived: number;
};

/** Union of all SSE event types */
export type EffieWarmupEvent =
  | { type: "start"; total: number }
  | { type: "progress"; data: EffieWarmupProgressEvent }
  | { type: "downloading"; data: EffieWarmupDownloadingEvent }
  | { type: "keepalive"; cached: number; failed: number; total: number }
  | { type: "summary"; cached: number; failed: number; total: number }
  | { type: "complete"; status: "ready" }
  | { type: "error"; message: string };

/** Current warmup state */
export type EffieWarmupState = {
  status: "idle" | "connecting" | "warming" | "ready" | "error";
  total: number;
  cached: number;
  failed: number;
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
    const data = JSON.parse((e as MessageEvent).data);
    onEvent({ type: "start", total: data.total });
  });

  eventSource.addEventListener("progress", (e) => {
    const data = JSON.parse(
      (e as MessageEvent).data,
    ) as EffieWarmupProgressEvent;
    onEvent({ type: "progress", data });
  });

  eventSource.addEventListener("downloading", (e) => {
    const data = JSON.parse(
      (e as MessageEvent).data,
    ) as EffieWarmupDownloadingEvent;
    onEvent({ type: "downloading", data });
  });

  eventSource.addEventListener("keepalive", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    onEvent({
      type: "keepalive",
      cached: data.cached,
      failed: data.failed,
      total: data.total,
    });
  });

  eventSource.addEventListener("summary", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    onEvent({
      type: "summary",
      cached: data.cached,
      failed: data.failed,
      total: data.total,
    });
  });

  eventSource.addEventListener("complete", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    onEvent({ type: "complete", status: data.status });
    eventSource.close();
  });

  eventSource.addEventListener("error", () => {
    onEvent({ type: "error", message: "Connection lost" });
    eventSource.close();
  });

  return () => eventSource.close();
}
