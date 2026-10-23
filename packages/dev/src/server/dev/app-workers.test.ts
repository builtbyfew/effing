import http from "node:http";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ResolvedFns } from "../../fns";
import {
  createAppWorkers,
  type AppWorkerData,
  type AppWorkersOptions,
  type InvokeResult,
} from "./app-workers";

// A worker that speaks the app worker protocol over a few test routes.
const FIXTURE = fileURLToPath(
  new URL("./__fixtures__/app-worker.mjs", import.meta.url),
);

const FNS: ResolvedFns = {
  image: [],
  annie: [{ id: "a", absPath: "/app/a.fn.tsx" }],
  effie: [],
};

type State = {
  thread: number;
  fns: ResolvedFns;
  invalidated: string[];
  preload: boolean;
};

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
});

async function start({
  failStart,
  ...options
}: Partial<AppWorkersOptions> & { failStart?: boolean } = {}) {
  const invoked: unknown[] = [];
  const invoke = async (payload: unknown): Promise<InvokeResult> => {
    invoked.push(payload);
    if (payload === "unclonable") {
      return {
        error: { name: "Error", message: "transform failed", plugin: () => {} },
      };
    }
    if (payload === "throws") throw new Error("handler threw");
    return { result: `got ${String(payload)}` };
  };
  const app = createAppWorkers({
    size: 2,
    workerFile: FIXTURE,
    data: () =>
      ({
        buildDir: "",
        fns: FNS,
        resolutions: [],
        project: "test",
        failStart,
      }) as AppWorkerData,
    invoke,
    ...options,
  });
  const server = http.createServer((req, res) => app.handle(req, res));
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const { port } = server.address() as { port: number };
  cleanups.push(async () => {
    server.closeAllConnections();
    server.close();
    await app.close();
  });
  const base = `http://127.0.0.1:${port}`;
  const state = async (ms = 0): Promise<State> =>
    (await (await fetch(`${base}/state?ms=${ms}`)).json()) as State;
  return { app, base, invoked, state };
}

describe("createAppWorkers", () => {
  test("proxies a request and its response", async () => {
    const { base } = await start();
    const res = await fetch(`${base}/echo`, {
      method: "POST",
      headers: { "X-Test": "header" },
      body: "body",
    });
    expect(res.status).toBe(201);
    expect(res.statusText).toBe("Made");
    expect(res.headers.get("x-echo")).toBe("header");
    expect(res.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
    expect(await res.text()).toBe("POST body");
  });

  test("reuses an idle worker, and spawns up to size for requests in flight", async () => {
    const { state } = await start({ size: 2 });
    const first = await state();
    const second = await state();
    expect(second.thread).toBe(first.thread);

    const threads = await Promise.all([state(300), state(300), state(300)]);
    expect(new Set(threads.map((s) => s.thread)).size).toBe(2);
  });

  test("prewarms half the workers, telling them to preload the fns", async () => {
    const { app, state } = await start({ size: 4 });
    app.prewarm();
    // Requests in flight together take the two prewarmed workers first, then
    // spawn the rest on demand, which don't preload.
    const states = await Promise.all([state(300), state(300), state(300)]);
    expect(new Set(states.map((s) => s.thread)).size).toBe(3);
    expect(states.map((s) => s.preload).sort()).toEqual([false, true, true]);
  });

  test("leaves workers spawned on demand to load fns on demand", async () => {
    const { state } = await start();
    expect((await state()).preload).toBe(false);
  });

  test("aborts the worker's request when the client goes away", async () => {
    const { base, invoked } = await start();
    const controller = new AbortController();
    const res = await fetch(`${base}/hold?id=x`, { signal: controller.signal });
    const reader = res.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("first");
    controller.abort();
    await vi.waitFor(() => expect(invoked).toContainEqual({ aborted: "x" }));
  });

  test("fails a crashed worker's requests and replaces the worker", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { base, state } = await start({ size: 1 });
    const before = await state();

    const slow = fetch(`${base}/state?ms=2000`);
    // Let the slow request reach the worker before it crashes.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const crash = await fetch(`${base}/crash`);
    expect(crash.status).toBe(502);
    expect((await slow).status).toBe(502);
    expect(errors).toHaveBeenCalledWith(
      "App worker stopped:",
      expect.objectContaining({ message: "fn blew up" }),
    );

    const after = await state();
    expect(after.thread).not.toBe(before.thread);
  });

  test("cuts off a response when its worker crashes mid-stream", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { base, state } = await start({ size: 1 });
    const before = await state();

    const res = await fetch(`${base}/crash-midway`);
    expect(res.status).toBe(200);
    await expect(res.text()).rejects.toThrow();
    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        "App worker stopped:",
        expect.objectContaining({ message: "fn blew up midway" }),
      ),
    );

    const after = await state();
    expect(after.thread).not.toBe(before.thread);
  });

  test("reports a worker that fails to start", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { base } = await start({ failStart: true });
    const res = await fetch(`${base}/state`);
    expect(res.status).toBe(502);
    expect(await res.text()).toBe("app worker failed: worker failed to start");
  });

  test("answers module runner requests, with errors as plain data", async () => {
    const { base } = await start();
    const invoke = async (payload: string) =>
      (await fetch(`${base}/invoke?payload=${payload}`)).json();
    expect(await invoke("hello")).toEqual({ result: "got hello" });
    expect(await invoke("unclonable")).toEqual({
      error: { name: "Error", message: "transform failed" },
    });
    expect(await invoke("throws")).toMatchObject({
      error: { name: "Error", message: "handler threw" },
    });
  });

  test("passes invalidations and fns on to every worker", async () => {
    const { app, state } = await start({ size: 2 });
    // Two requests in flight at once, so two workers.
    const spawned = await Promise.all([state(200), state(200)]);
    expect(spawned[0].thread).not.toBe(spawned[1].thread);
    expect(spawned[0].fns).toEqual(FNS);

    const fns: ResolvedFns = { ...FNS, effie: [{ id: "e", absPath: "/e" }] };
    app.invalidate("/app/shared.ts");
    app.setFns(fns);
    await vi.waitFor(async () => {
      const states = await Promise.all([state(200), state(200)]);
      expect(new Set(states.map((s) => s.thread)).size).toBe(2);
      for (const s of states) {
        expect(s.invalidated).toEqual(["/app/shared.ts"]);
        expect(s.fns).toEqual(fns);
      }
    });
  });

  test("refuses requests once closed", async () => {
    const { app, base } = await start();
    await app.close();
    const res = await fetch(`${base}/state`);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("the dev server is closing");
  });
});
