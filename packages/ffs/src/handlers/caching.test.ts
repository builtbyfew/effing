import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { LocalTransientStore } from "../storage";
import { fetchAndCache } from "./caching";
import type { ServerContext } from "./shared";

describe("fetchAndCache", () => {
  let server: http.Server;
  let url: string;
  let baseDir: string;
  let store: LocalTransientStore;

  beforeAll(async () => {
    // Fails mid-body, as an annie whose fn throws after its first frame.
    server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/x-tar" });
      res.write(Buffer.alloc(1024));
      setTimeout(() => res.destroy(), 50);
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
    await expect(
      fetchAndCache(url, "sources/broken", () => {}, ctx),
    ).rejects.toThrow("terminated");
    expect(await store.exists("sources/broken")).toBe(false);
  });
});
