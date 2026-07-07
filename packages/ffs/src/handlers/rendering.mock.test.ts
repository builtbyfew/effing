import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { TransientStore } from "../storage";
import { storeKeys } from "../storage";
import type {
  ServerContext,
  VideoJob,
  ResolvedRenderJob,
  DeferredRenderJob,
} from "./shared";

vi.mock("../renderer", () => ({
  EffieRenderer: vi.fn(),
}));

vi.mock("../fetch", () => ({
  ffsFetch: vi.fn(),
}));

vi.mock("./caching", () => ({
  warmupSources: vi.fn(async () => {}),
  purgeCachedSources: vi.fn(async () => ({ purged: 0, total: 0 })),
}));

function mockRequest(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

function mockResponse(options: { autoFinish?: boolean } = {}): Response & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  ended: boolean;
  emitEvent: (event: string) => void;
} {
  const { autoFinish = true } = options;
  const handlers = new Map<string, Array<() => void>>();
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    ended: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    set(key: string, value: string) {
      res.headers[key] = value;
      return res;
    },
    setHeader(key: string, value: string) {
      res.headers[key] = value;
      return res;
    },
    write: vi.fn(),
    end: vi.fn(() => {
      res.ended = true;
    }),
    flushHeaders: vi.fn(),
    pipe: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), cb]);
      if (event === "finish" && autoFinish) process.nextTick(cb);
      return res;
    }),
    off: vi.fn((event: string, cb: () => void) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((handler) => handler !== cb),
      );
      return res;
    }),
    emitEvent(event: string) {
      for (const cb of handlers.get(event) ?? []) cb();
    },
    destroyed: false,
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    ended: boolean;
    emitEvent: (event: string) => void;
  };
}

function mockContext(storeData: Record<string, unknown> = {}): ServerContext {
  return {
    transientStore: {
      ttlMs: 60 * 60 * 1000,
      getJson: vi.fn(
        async (key: string) => storeData[key] ?? null,
      ) as TransientStore["getJson"],
      putJson: vi.fn(async (key: string, data: unknown) => {
        storeData[key] = data;
      }),
      delete: vi.fn(async (key: string) => {
        delete storeData[key];
      }),
      put: vi.fn(),
      getStream: vi.fn(),
      exists: vi.fn(),
      existsMany: vi.fn(),
      close: vi.fn(),
    },
    baseUrl: "http://localhost:2000",
    skipValidation: true,
    warmupConcurrency: 4,
  };
}

describe("streamRenderVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("returns 404 when video job does not exist", async () => {
    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: "nonexistent-id" });
    const res = mockResponse();
    const ctx = mockContext();

    await streamRenderVideo(req, res, ctx);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: "Video not found or expired",
      code: "NOT_FOUND",
    });
  });

  test("serves video when video job exists", async () => {
    const { Readable } = await import("stream");

    const videoJob: VideoJob = {
      effie: {
        width: 1080,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "#000000" },
        segments: [],
        sources: {},
      },
      scale: 1,
    };

    const jobId = "test-video-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.videoJob(jobId)]: videoJob,
    };

    const mockVideoStream = new Readable({ read() {} });
    mockVideoStream.pipe = vi.fn();

    const mockRenderer = {
      render: vi.fn().mockResolvedValue(mockVideoStream),
      close: vi.fn(),
    };

    const { EffieRenderer } = await import("../renderer");
    vi.mocked(EffieRenderer).mockImplementation(
      () => mockRenderer as unknown as InstanceType<typeof EffieRenderer>,
    );

    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);

    await streamRenderVideo(req, res, ctx);

    expect(res.headers["Content-Type"]).toBe("video/mp4");
    expect(mockVideoStream.pipe).toHaveBeenCalledWith(res);
    // Video job should be deleted (one-time use)
    expect(ctx.transientStore.delete).toHaveBeenCalledWith(
      storeKeys.videoJob(jobId),
    );
  });

  test("closes the renderer when the client aborts mid-stream", async () => {
    const { Readable } = await import("stream");

    const videoJob: VideoJob = {
      effie: {
        width: 1080,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "#000000" },
        segments: [],
        sources: {},
      },
      scale: 1,
    };

    const jobId = "aborted-video-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.videoJob(jobId)]: videoJob,
    };

    const mockVideoStream = new Readable({ read() {} });
    mockVideoStream.pipe = vi.fn();

    const mockRenderer = {
      render: vi.fn().mockResolvedValue(mockVideoStream),
      close: vi.fn(),
    };

    const { EffieRenderer } = await import("../renderer");
    vi.mocked(EffieRenderer).mockImplementation(
      () => mockRenderer as unknown as InstanceType<typeof EffieRenderer>,
    );

    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    // "finish" never fires: the client disconnects before the download ends.
    const res = mockResponse({ autoFinish: false });
    const ctx = mockContext(storeData);

    const handled = streamRenderVideo(req, res, ctx);

    // Wait for the handler to start piping, then simulate the client abort.
    await vi.waitFor(() => {
      expect(mockVideoStream.pipe).toHaveBeenCalledWith(res);
    });
    res.emitEvent("close");
    await handled;

    expect(mockVideoStream.destroyed).toBe(true);
    expect(mockRenderer.close).toHaveBeenCalledOnce();
  });

  test("local direct-stream fires onRenderComplete", async () => {
    const { Readable } = await import("stream");

    const videoJob: VideoJob = {
      effie: {
        width: 1080,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "#000000" },
        segments: [],
        sources: {},
      },
      scale: 1,
    };

    const jobId = "local-render-complete-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.videoJob(jobId)]: videoJob,
    };

    const mockVideoStream = new Readable({ read() {} });
    mockVideoStream.pipe = vi.fn();

    const mockRenderer = {
      render: vi.fn().mockResolvedValue(mockVideoStream),
      close: vi.fn(),
    };

    const { EffieRenderer } = await import("../renderer");
    vi.mocked(EffieRenderer).mockImplementation(
      () => mockRenderer as unknown as InstanceType<typeof EffieRenderer>,
    );

    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);
    ctx.onRenderComplete = vi.fn();

    await streamRenderVideo(req, res, ctx);

    expect(ctx.onRenderComplete).toHaveBeenCalledOnce();
    expect(ctx.onRenderComplete).toHaveBeenCalledWith({
      effie: videoJob.effie,
      metadata: undefined,
      wallClockTime: expect.any(Number),
    });
    const arg = vi.mocked(ctx.onRenderComplete).mock.calls[0][0];
    expect(arg.wallClockTime).toBeGreaterThan(0);
  });

  test("backend proxy fires onRenderComplete", async () => {
    const videoJob: VideoJob = {
      effie: {
        width: 1080,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "#000000" },
        segments: [],
        sources: {},
      },
      scale: 1,
    };

    const jobId = "backend-render-complete-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.videoJob(jobId)]: videoJob,
    };

    const { ffsFetch } = await import("../fetch");
    vi.mocked(ffsFetch).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "video/mp4",
        "content-length": "1234",
      }),
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          releaseLock: vi.fn(),
          cancel: vi.fn(),
        }),
      },
    } as unknown as Awaited<ReturnType<typeof ffsFetch>>);

    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);
    ctx.renderBackendResolver = () => ({
      baseUrl: "http://backend:3000",
    });
    ctx.onRenderComplete = vi.fn();

    await streamRenderVideo(req, res, ctx);

    expect(ctx.onRenderComplete).toHaveBeenCalledOnce();
    expect(ctx.onRenderComplete).toHaveBeenCalledWith({
      effie: videoJob.effie,
      metadata: undefined,
      wallClockTime: expect.any(Number),
    });
    const arg = vi.mocked(ctx.onRenderComplete).mock.calls[0][0];
    expect(arg.wallClockTime).toBeGreaterThan(0);
  });

  test("onRenderComplete error is caught and does not crash the handler", async () => {
    const { Readable } = await import("stream");

    const videoJob: VideoJob = {
      effie: {
        width: 1080,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "#000000" },
        segments: [],
        sources: {},
      },
      scale: 1,
    };

    const jobId = "hook-error-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.videoJob(jobId)]: videoJob,
    };

    const mockVideoStream = new Readable({ read() {} });
    mockVideoStream.pipe = vi.fn();

    const mockRenderer = {
      render: vi.fn().mockResolvedValue(mockVideoStream),
      close: vi.fn(),
    };

    const { EffieRenderer } = await import("../renderer");
    vi.mocked(EffieRenderer).mockImplementation(
      () => mockRenderer as unknown as InstanceType<typeof EffieRenderer>,
    );

    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);
    ctx.onRenderComplete = vi.fn().mockRejectedValue(new Error("hook boom"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(streamRenderVideo(req, res, ctx)).resolves.toBeUndefined();

    expect(res.headers["Content-Type"]).toBe("video/mp4");
    expect(consoleSpy).toHaveBeenCalledWith(
      "onRenderComplete hook error:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  test("does not delete video job when proxying to render backend", async () => {
    const videoJob: VideoJob = {
      effie: {
        width: 1080,
        height: 1080,
        fps: 30,
        cover: "https://example.com/cover.png",
        background: { type: "color", color: "#000000" },
        segments: [],
        sources: {},
      },
      scale: 1,
    };

    const jobId = "backend-proxy-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.videoJob(jobId)]: videoJob,
    };

    // Mock ffsFetch to return a fake binary response for the backend proxy
    const { ffsFetch } = await import("../fetch");
    vi.mocked(ffsFetch).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "video/mp4",
        "content-length": "1234",
      }),
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          releaseLock: vi.fn(),
          cancel: vi.fn(),
        }),
      },
    } as unknown as Awaited<ReturnType<typeof ffsFetch>>);

    const { streamRenderVideo } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);
    ctx.renderBackendResolver = () => ({
      baseUrl: "http://backend:3000",
    });

    await streamRenderVideo(req, res, ctx);

    // Should NOT have deleted the video job — the backend handles deletion
    expect(ctx.transientStore.delete).not.toHaveBeenCalled();
  });
});

describe("video job gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("video job is not in store after createRenderJob", async () => {
    const { createRenderJob } = await import("./rendering");

    const storeData: Record<string, unknown> = {};
    const ctx = mockContext(storeData);

    const effie = {
      width: 1080,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color" as const, color: "#000000" },
      segments: [
        {
          layers: [
            {
              type: "image" as const,
              source: "#bg",
              x: 0,
              y: 0,
              width: 1080,
              height: 1080,
              startFrame: 0,
              endFrame: 30,
            },
          ],
        },
      ],
      sources: {
        bg: "https://example.com/bg.png",
      },
    };

    const req = {
      body: { effie, scale: 1 },
    } as unknown as Request;
    const res = mockResponse();

    await createRenderJob(req, res, ctx);

    expect(res.statusCode).toBe(200);
    const responseBody = res.body as { id: string; progressUrl: string };
    expect(responseBody.id).toBeDefined();
    expect(responseBody.progressUrl).toContain("/render/");
    expect(responseBody.progressUrl).toContain("/progress");

    // Verify no video job exists yet
    const videoJobKey = storeKeys.videoJob(responseBody.id);
    expect(storeData[videoJobKey]).toBeUndefined();

    // But render job should exist with kind: "resolved"
    const renderJobKey = storeKeys.renderJob(responseBody.id);
    expect(storeData[renderJobKey]).toBeDefined();
    expect((storeData[renderJobKey] as ResolvedRenderJob).kind).toBe(
      "resolved",
    );
  });

  test("URL effie stores DeferredRenderJob without calling ffsFetch", async () => {
    const { ffsFetch } = await import("../fetch");
    const { createRenderJob } = await import("./rendering");

    const storeData: Record<string, unknown> = {};
    const ctx = mockContext(storeData);

    const req = {
      body: { effie: "https://example.com/effie.json", scale: 2 },
    } as unknown as Request;
    const res = mockResponse();

    await createRenderJob(req, res, ctx);

    expect(res.statusCode).toBe(200);
    const responseBody = res.body as { id: string; progressUrl: string };
    expect(responseBody.id).toBeDefined();

    // ffsFetch should NOT have been called
    expect(ffsFetch).not.toHaveBeenCalled();

    // Render job should be deferred
    const renderJobKey = storeKeys.renderJob(responseBody.id);
    const job = storeData[renderJobKey] as DeferredRenderJob;
    expect(job.kind).toBe("deferred");
    expect(job.effieUrl).toBe("https://example.com/effie.json");
    expect(job.scale).toBe(2);

    // No warmup job should exist (deferred)
    const warmupJobKey = storeKeys.warmupJob(job.warmupJobId);
    expect(storeData[warmupJobKey]).toBeUndefined();
  });
});

describe("streamRenderProgress with deferred jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function parseSSEEvents(res: ReturnType<typeof mockResponse>) {
    const events: Array<{ event: string; data: unknown }> = [];
    const writeMock = res.write as unknown as ReturnType<typeof vi.fn>;
    for (const call of writeMock.mock.calls) {
      const text = call[0] as string;
      const eventMatch = text.match(/^event: (.+)$/m);
      const dataMatch = text.match(/^data: (.+)$/m);
      if (eventMatch && dataMatch) {
        events.push({
          event: eventMatch[1],
          data: JSON.parse(dataMatch[1]),
        });
      }
    }
    return events;
  }

  test("resolves deferred job, emits effie:fetching/effie:fetched", async () => {
    const { ffsFetch } = await import("../fetch");

    const effieData = {
      width: 1080,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color" as const, color: "#000000" },
      segments: [
        {
          layers: [
            {
              type: "image" as const,
              source: "#bg",
              x: 0,
              y: 0,
              width: 1080,
              height: 1080,
              startFrame: 0,
              endFrame: 30,
            },
          ],
        },
      ],
      sources: { bg: "https://example.com/bg.png" },
    };

    vi.mocked(ffsFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(effieData),
    } as unknown as Awaited<ReturnType<typeof ffsFetch>>);

    const jobId = "deferred-job-id";
    const warmupJobId = "deferred-warmup-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.renderJob(jobId)]: {
        kind: "deferred",
        effieUrl: "https://example.com/effie.json",
        scale: 1,
        warmupJobId,
        createdAt: Date.now(),
      } satisfies DeferredRenderJob,
    };

    const { streamRenderProgress } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);

    await streamRenderProgress(req, res, ctx);

    const events = parseSSEEvents(res);

    // Should have emitted effie:fetching and effie:fetched
    expect(events.find((e) => e.event === "effie:fetching")).toEqual({
      event: "effie:fetching",
      data: { url: "https://example.com/effie.json" },
    });
    expect(events.find((e) => e.event === "effie:fetched")).toEqual({
      event: "effie:fetched",
      data: { url: "https://example.com/effie.json" },
    });

    // Should have stored a warmup job after resolving
    const warmupJobKey = storeKeys.warmupJob(warmupJobId);
    expect(ctx.transientStore.putJson).toHaveBeenCalledWith(
      warmupJobKey,
      expect.objectContaining({ sources: expect.any(Array) }),
      ctx.transientStore.ttlMs,
    );

    // Should have ended with ready (non-upload mode)
    expect(events.find((e) => e.event === "ready")).toBeDefined();
  });

  test("non-upload progress path does not fire onRenderComplete", async () => {
    const { ffsFetch } = await import("../fetch");

    const effieData = {
      width: 1080,
      height: 1080,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color" as const, color: "#000000" },
      segments: [
        {
          layers: [
            {
              type: "image" as const,
              source: "#bg",
              x: 0,
              y: 0,
              width: 1080,
              height: 1080,
              startFrame: 0,
              endFrame: 30,
            },
          ],
        },
      ],
      sources: { bg: "https://example.com/bg.png" },
    };

    vi.mocked(ffsFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(effieData),
    } as unknown as Awaited<ReturnType<typeof ffsFetch>>);

    const jobId = "no-render-complete-id";
    const warmupJobId = "no-render-warmup-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.renderJob(jobId)]: {
        kind: "deferred",
        effieUrl: "https://example.com/effie.json",
        scale: 1,
        warmupJobId,
        createdAt: Date.now(),
      } satisfies DeferredRenderJob,
    };

    const { streamRenderProgress } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);
    ctx.onRenderComplete = vi.fn();

    await streamRenderProgress(req, res, ctx);

    const events = parseSSEEvents(res);
    expect(events.find((e) => e.event === "ready")).toBeDefined();
    expect(ctx.onRenderComplete).not.toHaveBeenCalled();
  });

  test("deferred fetch failure emits SSE error with phase effie", async () => {
    const { ffsFetch } = await import("../fetch");

    vi.mocked(ffsFetch).mockRejectedValue(new Error("Network error"));

    const jobId = "deferred-fail-id";
    const storeData: Record<string, unknown> = {
      [storeKeys.renderJob(jobId)]: {
        kind: "deferred",
        effieUrl: "https://example.com/bad.json",
        scale: 1,
        warmupJobId: "unused-warmup-id",
        createdAt: Date.now(),
      } satisfies DeferredRenderJob,
    };

    const { streamRenderProgress } = await import("./rendering");

    const req = mockRequest({ id: jobId });
    const res = mockResponse();
    const ctx = mockContext(storeData);

    await streamRenderProgress(req, res, ctx);

    const events = parseSSEEvents(res);

    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data).toEqual({
      phase: "effie",
      message: expect.stringContaining("https://example.com/bad.json"),
      code: "FETCH_FAILED",
    });
  });
});
