import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { TransientStore } from "./storage";
import { storeKeys } from "./storage";
import type { ServerContext, VideoJob } from "./handlers/shared";

vi.mock("./render", () => ({
  EffieRenderer: vi.fn(),
}));

vi.mock("./fetch", () => ({
  ffsFetch: vi.fn(),
}));

function mockRequest(params: Record<string, string> = {}): Request {
  return { params } as unknown as Request;
}

function mockResponse(): Response & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  ended: boolean;
} {
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
    on: vi.fn(),
    destroyed: false,
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    ended: boolean;
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
    const { streamRenderVideo } = await import("./handlers/rendering");

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

    const { EffieRenderer } = await import("./render");
    vi.mocked(EffieRenderer).mockImplementation(
      () => mockRenderer as unknown as InstanceType<typeof EffieRenderer>,
    );

    const { streamRenderVideo } = await import("./handlers/rendering");

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
    const { ffsFetch } = await import("./fetch");
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

    const { streamRenderVideo } = await import("./handlers/rendering");

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
    const { createRenderJob } = await import("./handlers/rendering");

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

    // But render job should exist
    const renderJobKey = storeKeys.renderJob(responseBody.id);
    expect(storeData[renderJobKey]).toBeDefined();
  });
});
