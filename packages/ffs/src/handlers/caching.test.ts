import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { LocalTransientStore } from "../storage";
import { fetchAndCache, streamWarmupProgress } from "./caching";
import { FetchError } from "./errors";
import type { ServerContext } from "./shared";

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(
        `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      ),
    ),
  );
}

describe("streamWarmupProgress via a warmup backend", () => {
  let backend: http.Server;
  let ffs: http.Server;
  let ffsUrl: string;

  beforeAll(async () => {
    // The backend's progress stream for job `drop`, `end` or `complete`: a
    // progress event, then the connection cut, a clean end without a result,
    // or the backend's own complete event.
    backend = http.createServer((req, res) => {
      const job = req.url?.split("/")[2];
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      let events = `event: start\ndata: {"total":1}\n\n`;
      if (job === "complete") {
        events += `event: complete\ndata: {"status":"ready"}\n\n`;
      }
      res.write(events, () => {
        if (job === "drop") res.destroy();
        else res.end();
      });
    });
    const backendUrl = await listen(backend);

    const ctx = {
      transientStore: { getJson: async () => ({ sources: [] }) },
      warmupBackendResolver: () => ({ baseUrl: backendUrl }),
    } as unknown as ServerContext;
    const app = express();
    app.get("/warmup/:id/progress", (req, res) => {
      void streamWarmupProgress(req, res, ctx);
    });
    ffs = http.createServer(app);
    ffsUrl = await listen(ffs);
  });

  afterAll(() => {
    backend.close();
    ffs.close();
  });

  async function events(job: string) {
    const response = await fetch(`${ffsUrl}/warmup/${job}/progress`);
    return (await response.text())
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const [event, data] = block.split("\n");
        return {
          event: event.slice("event: ".length),
          data: JSON.parse(data.slice("data: ".length)) as unknown,
        };
      });
  }

  test("ends with an error event when the backend's stream fails", async () => {
    expect(await events("drop")).toEqual([
      { event: "start", data: { total: 1 } },
      {
        event: "error",
        data: {
          message: "Backend stream failed: terminated",
          code: "BACKEND_FAILED",
        },
      },
    ]);
  });

  test("ends with an error event when the backend's stream ends without a result", async () => {
    expect(await events("end")).toEqual([
      { event: "start", data: { total: 1 } },
      {
        event: "error",
        data: {
          message: "The warmup backend's stream ended without a result",
          code: "BACKEND_FAILED",
        },
      },
    ]);
  });

  test("passes the backend's own result on, and nothing after it", async () => {
    expect(await events("complete")).toEqual([
      { event: "start", data: { total: 1 } },
      { event: "complete", data: { status: "ready" } },
    ]);
  });
});

describe("fetchAndCache", () => {
  let server: http.Server;
  let url: string;
  let baseDir: string;
  let store: LocalTransientStore;
  let fail: () => void;

  beforeAll(async () => {
    // Sends some bytes, and fails mid-body (as an annie whose fn throws after
    // its first frame) when the test calls `fail`.
    server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/x-tar" });
      res.write(Buffer.alloc(1024));
      fail = () => res.destroy();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "ffs-caching-"));
    store = new LocalTransientStore({ baseDir });
  });

  afterAll(() => {
    store.close();
    server.close();
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  test("rejects, caching nothing, when the source fails mid-body", async () => {
    const ctx = { transientStore: store } as unknown as ServerContext;
    // Fail once the response has started, i.e. the download.
    const onEvent = (event: string) => {
      if (event === "downloading") fail();
    };
    await expect(
      fetchAndCache(url, "sources/broken", onEvent, ctx),
    ).rejects.toThrow("terminated");
    expect(await store.exists("sources/broken")).toBe(false);
  });

  test("names the source that failed mid-body", async () => {
    const ctx = { transientStore: store } as unknown as ServerContext;
    const onEvent = (event: string) => {
      if (event === "downloading") fail();
    };
    const error = await fetchAndCache(url, "sources/named", onEvent, ctx).then(
      () => undefined,
      (err: unknown) => err,
    );
    // A FetchError, so it's reported as FETCH_FAILED.
    expect(error).toBeInstanceOf(FetchError);
    expect(error).toMatchObject({
      url,
      message: `Failed to fetch ${url}: response body failed: terminated`,
      cause: expect.objectContaining({ message: "terminated" }),
    });
  });
});
