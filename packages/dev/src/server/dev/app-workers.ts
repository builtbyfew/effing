import http from "node:http";
import { pipeline } from "node:stream";
import { SHARE_ENV, Worker } from "node:worker_threads";
import type { Resolution } from "../../config/schema";
import type { ResolvedFns } from "../../fns";

/** The dev app, served on this thread or on worker threads. */
export type DevApp = {
  handle(req: http.IncomingMessage, res: http.ServerResponse): void;
  /** Make every module runner re-fetch `file` on its next import. */
  invalidate(file: string): void;
  /** Pass on the fns after one was added or removed. */
  setFns(fns: ResolvedFns): void;
  close(): Promise<void>;
};

/** What an app worker starts with (see app-worker.ts). */
export type AppWorkerData = {
  buildDir: string;
  fns: ResolvedFns;
  resolutions: Resolution[];
  project: string;
};

/** A reply to a worker's Vite module runner request. */
export type InvokeResult = { result: unknown } | { error: unknown };

export type ToAppWorker =
  | { type: "invoke-result"; id: number; result: InvokeResult }
  | { type: "invalidate"; file: string }
  | { type: "fns"; fns: ResolvedFns };

export type FromAppWorker =
  | { type: "ready"; port: number }
  | { type: "invoke"; id: number; payload: unknown };

export type AppWorkersOptions = {
  /** Upper bound on worker threads, spawned on demand. */
  size: number;
  /** Path of the worker entry (`app-worker.js`). */
  workerFile: string;
  /** Start data for a new worker, taken when it's spawned. */
  data: () => AppWorkerData;
  /**
   * Answers a worker's Vite module runner request — in the dev server, the
   * SSR environment's `hot.handleInvoke`, so workers share its transforms.
   */
  invoke: (payload: unknown) => Promise<InvokeResult>;
};

type Slot = { worker: Worker; port: Promise<number>; inFlight: number };

/**
 * Serves the dev app on worker threads, so requests (e.g. the annies of one
 * effie, which FFS fetches all at once) render in parallel instead of taking
 * turns on one thread. Each worker serves the app on a loopback port of its
 * own, and requests are proxied to it.
 *
 * Workers are spawned lazily, up to `size`. A request goes to an idle worker,
 * else a new one, else the one with the fewest requests in flight. Workers
 * serve requests concurrently, so an fn that fetches another fn from this
 * server never waits for a free worker.
 */
export function createAppWorkers(options: AppWorkersOptions): DevApp {
  const slots: Slot[] = [];
  const agent = new http.Agent({ keepAlive: true });
  let closed = false;

  const spawn = (): Slot => {
    // SHARE_ENV: fns read process.env, and BASE_URL is set after the server
    // starts (by `effing render`), so a copy taken at spawn could be stale.
    const worker = new Worker(options.workerFile, {
      env: SHARE_ENV,
      workerData: options.data(),
    });
    let ready!: (port: number) => void;
    let failed!: (err: unknown) => void;
    const port = new Promise<number>((resolve, reject) => {
      ready = resolve;
      failed = reject;
    });
    port.catch(() => {}); // reported to the requests waiting on it
    const slot: Slot = { worker, port, inFlight: 0 };

    worker.on("message", (msg: FromAppWorker) => {
      if (msg.type === "ready") {
        ready(msg.port);
        return;
      }
      void options
        .invoke(msg.payload)
        .catch((err: unknown) => ({ error: plainError(err) }))
        .then((result) => {
          try {
            post(worker, { type: "invoke-result", id: msg.id, result });
          } catch {
            // Vite spreads an error's own fields into its reply, and some
            // can't be cloned; keep its name, message and stack.
            const error =
              "error" in result
                ? result.error
                : new Error("Vite's reply could not be sent to the worker");
            post(worker, {
              type: "invoke-result",
              id: msg.id,
              result: { error: plainError(error) },
            });
          }
        });
    });

    // A worker that stops (an uncaught error in an fn, say) takes its
    // in-flight requests down with it, as their connections close. Drop it,
    // so later requests go to a new one.
    let stopped = false;
    const stop = (err: unknown) => {
      if (stopped) return;
      stopped = true;
      const index = slots.indexOf(slot);
      if (index !== -1) slots.splice(index, 1);
      failed(err);
      if (!closed) console.error("App worker stopped:", err);
    };
    worker.on("error", stop);
    worker.on("exit", (code) =>
      stop(new Error(`app worker exited with code ${code}`)),
    );

    slots.push(slot);
    return slot;
  };

  const acquire = (): Slot => {
    const idle = slots.find((s) => s.inFlight === 0);
    if (idle) return idle;
    if (slots.length < options.size) return spawn();
    return slots.reduce((a, b) => (b.inFlight < a.inFlight ? b : a));
  };

  return {
    handle(req, res) {
      if (closed) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("the dev server is closing");
        return;
      }
      const slot = acquire();
      slot.inFlight++;
      res.on("close", () => slot.inFlight--);
      slot.port.then(
        (port) => proxy(req, res, port, agent),
        (err: unknown) => fail(res, err),
      );
    },
    invalidate(file) {
      for (const s of slots) post(s.worker, { type: "invalidate", file });
    },
    setFns(fns) {
      for (const s of slots) post(s.worker, { type: "fns", fns });
    },
    async close() {
      closed = true;
      agent.destroy();
      await Promise.all(slots.map((s) => s.worker.terminate()));
      slots.length = 0;
    },
  };
}

// Headers that describe one connection, not the message, so they don't carry
// over from the client's connection to the worker's or back.
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function forwardable(
  headers: http.IncomingHttpHeaders,
): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...headers };
  for (const h of HOP_BY_HOP) delete out[h];
  return out;
}

function proxy(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  port: number,
  agent: http.Agent,
): void {
  // The client may have gone while the worker was starting.
  if (res.closed) return;
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port,
      method: req.method,
      path: req.url,
      headers: forwardable(req.headers),
      agent,
    },
    (response) => {
      res.writeHead(
        response.statusCode ?? 502,
        response.statusMessage,
        forwardable(response.headers),
      );
      // Ends the response early if the worker stops mid-stream.
      pipeline(response, res, () => {});
    },
  );
  upstream.on("error", (err) => fail(res, err));
  // The client went away (e.g. FFS aborted): abort the worker's request too,
  // so the fn stops rendering.
  res.on("close", () => {
    if (!res.writableFinished) upstream.destroy();
  });
  // Not pipeline(): on an upstream error it would destroy `req`, and with it
  // the socket `fail` replies on.
  req.pipe(upstream);
}

function fail(res: http.ServerResponse, err: unknown): void {
  if (res.closed) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`app worker failed: ${plainError(err).message}`);
}

function plainError(err: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  const e = (err ?? {}) as {
    name?: unknown;
    message?: unknown;
    stack?: unknown;
  };
  return {
    name: String(e.name ?? "Error"),
    message: String(e.message ?? err),
    stack: typeof e.stack === "string" ? e.stack : undefined,
  };
}

function post(worker: Worker, msg: ToAppWorker): void {
  worker.postMessage(msg);
}
