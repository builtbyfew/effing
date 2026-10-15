// Entry point of the dev server's app workers (see app-workers.ts).
//
// Each worker serves the pre-built dev app on a loopback port of its own, and
// the dev server proxies each request to an idle worker, else a new one, else
// the least busy one. Fns are evaluated with the worker's own Vite module
// runner, whose requests are answered by the dev server's SSR environment over
// the parent port, so transforms are shared with every other worker.

import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";
import {
  ESModulesEvaluator,
  ModuleRunner,
  createNodeImportMeta,
} from "vite/module-runner";
import type { HotPayload } from "vite";
import { createRequestListener } from "@react-router/node";
import invariant from "tiny-invariant";
import type { ResolvedFns } from "../../fns";
import type {
  AppWorkerData,
  FromAppWorker,
  InvokeResult,
  ToAppWorker,
} from "./app-workers";
import { createFnLoader } from "./fn-loader";
import { invalidateFile } from "./invalidate";

invariant(parentPort, "app-worker must run in a worker thread");
const parent = parentPort;
const data = workerData as AppWorkerData;
const send = (msg: FromAppWorker) => parent.postMessage(msg);

let fns: ResolvedFns = data.fns;
let nextInvoke = 0;
const pendingInvokes = new Map<number, (result: InvokeResult) => void>();

const runner = new ModuleRunner(
  {
    transport: {
      invoke: (payload: HotPayload) =>
        new Promise<InvokeResult>((resolve) => {
          const id = nextInvoke++;
          pendingInvokes.set(id, resolve);
          send({ type: "invoke", id, payload });
        }),
    },
    createImportMeta: createNodeImportMeta,
    sourcemapInterceptor: "node",
    hmr: false,
  },
  new ESModulesEvaluator(),
);

parent.on("message", (msg: ToAppWorker) => {
  switch (msg.type) {
    case "invoke-result":
      pendingInvokes.get(msg.id)?.(msg.result);
      pendingInvokes.delete(msg.id);
      break;
    case "invalidate":
      invalidateFile(runner.evaluatedModules, msg.file);
      break;
    case "fns":
      fns = msg.fns;
      break;
  }
});

globalThis.__effingDevFnModuleLoader = createFnLoader(runner, () => fns);
globalThis.__effingDevResolutions = data.resolutions;
globalThis.__effingDevProjectName = data.project;

const build = await import(
  /* @vite-ignore */ pathToFileURL(path.join(data.buildDir, "server/index.js"))
    .href
);
const server = http.createServer(
  createRequestListener({ build, mode: "development" }),
);
// The dev server's keep-alive agent is the only client. Closing its idle
// connections would race with the agent reusing one (a 502 for that request).
server.keepAliveTimeout = 0;
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  invariant(address && typeof address === "object", "no server address");
  send({ type: "ready", port: address.port });
});
