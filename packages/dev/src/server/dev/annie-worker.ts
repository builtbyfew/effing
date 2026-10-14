// Entry point of the dev server's annie worker threads (see annie-pool.ts).
//
// Each worker evaluates user fns with its own Vite module runner, whose
// requests are answered by the dev server's SSR environment over the parent
// port. Transforms are thus shared with the main thread; the dev server tells
// every runner which files changed (see invalidate.ts).

import { parentPort } from "node:worker_threads";
import {
  ESModulesEvaluator,
  ModuleRunner,
  createNodeImportMeta,
} from "vite/module-runner";
import type { HotPayload } from "vite";
import { initFnRuntime, type FnKind, type FnModule } from "@effing/fn";
import { createFlatUrlBuilder } from "@effing/fn/server";
import invariant from "tiny-invariant";
import { serveAnnieJobs } from "./annie-jobs";
import type { FnPaths, FromWorker, ToWorker } from "./annie-protocol";
import { invalidateFile } from "./invalidate";

invariant(parentPort, "annie-worker must run in a worker thread");
const port = parentPort;

type InvokeResult = { result: unknown } | { error: unknown };

let nextInvoke = 0;
const pendingInvokes = new Map<number, (result: InvokeResult) => void>();

port.on("message", (msg: ToWorker) => {
  if (msg.type !== "invoke-result") return;
  pendingInvokes.get(msg.id)?.(msg.result as InvokeResult);
  pendingInvokes.delete(msg.id);
});

const runner = new ModuleRunner(
  {
    transport: {
      invoke: (payload: HotPayload) =>
        new Promise<InvokeResult>((resolve) => {
          const id = nextInvoke++;
          pendingInvokes.set(id, resolve);
          port.postMessage({
            type: "invoke",
            id,
            payload,
          } satisfies FromWorker);
        }),
    },
    createImportMeta: createNodeImportMeta,
    sourcemapInterceptor: "node",
    hmr: false,
  },
  new ESModulesEvaluator(),
);

port.on("message", (msg: ToWorker) => {
  if (msg.type === "invalidate")
    invalidateFile(runner.evaluatedModules, msg.file);
});

// Updated from every job, so fnModule() inside an annie sees the fns the
// dev server currently knows about.
let fnPaths: FnPaths = { image: {}, annie: {}, effie: {} };

async function loadModule<K extends FnKind>(
  kind: K,
  id: string,
): Promise<FnModule<K>> {
  const absPath = fnPaths[kind][id];
  invariant(absPath, `no ${kind} found for id '${id}'`);
  const mod = (await runner.import(absPath)) as FnModule<K>;
  return {
    runner: mod.runner,
    propsSchema: mod.propsSchema,
    previewProps: mod.previewProps,
  } as FnModule<K>;
}

let runtimeReady = false;

// Mirrors ensureFnRuntime() in app/fn.server.ts. Deferred to the first job
// because `effing render` sets BASE_URL after the server has started.
function ensureFnRuntime(): void {
  if (runtimeReady) return;
  const baseUrl = process.env.BASE_URL;
  const secretKey = process.env.SECRET_KEY;
  invariant(baseUrl, "BASE_URL env var is required");
  invariant(secretKey, "SECRET_KEY env var is required");
  initFnRuntime({
    moduleLoader: {
      loadModule,
      listModules: (kind) => Object.keys(fnPaths[kind]),
      hasModule: (kind, id) => id in fnPaths[kind],
    },
    urlBuilder: createFlatUrlBuilder({ baseUrl, secretKey }),
  });
  runtimeReady = true;
}

serveAnnieJobs(port, async (absPath, paths) => {
  fnPaths = paths;
  ensureFnRuntime();
  const mod = (await runner.import(absPath)) as FnModule<"annie">;
  return mod.runner;
});
