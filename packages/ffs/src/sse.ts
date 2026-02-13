// Warmup SSE events (sent by /warmup/:id/progress)
export type WarmupEventMap = {
  start: { total: number };
  progress: {
    url: string;
    status: "skipped" | "hit" | "cached" | "error";
    cached: number;
    failed: number;
    skipped: number;
    total: number;
    ms?: number;
    error?: string;
    reason?: string;
  };
  downloading: {
    url: string;
    status: "started" | "downloading";
    bytesReceived: number;
  };
  keepalive: { cached: number; failed: number; skipped: number; total: number };
  summary: { cached: number; failed: number; skipped: number; total: number };
  complete: { status: "ready" };
  error: { message: string };
};

// Render SSE events (sent by /render/:id/progress, excluding prefixed warmup events)
export type RenderEventMap = {
  keepalive: { phase: "warmup" | "render" } | { status: "uploading" };
  "purge:complete": { purged: number; total: number };
  "render:complete": {
    renderTime?: number;
    uploadTime: number;
    uploadCoverTime?: number;
    fetchCoverTime?: number;
  };
  complete: { status: "done" };
  ready: { videoUrl: string };
  error: { phase: "warmup" | "render"; message: string };
};

// Typed event sender — constrains event name and payload together
export type TypedEventSender<TMap extends Record<string, unknown>> = <
  K extends keyof TMap & string,
>(
  event: K,
  data: TMap[K],
) => void;

// Convenience aliases
export type WarmupEventSender = TypedEventSender<WarmupEventMap>;
export type RenderEventSender = TypedEventSender<RenderEventMap>;

// Untyped sender for wire boundaries (proxyRemoteSSE)
export type EventSender = (event: string, data: object) => void;
