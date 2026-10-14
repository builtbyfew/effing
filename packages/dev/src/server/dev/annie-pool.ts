import { Worker, SHARE_ENV } from "node:worker_threads";
import type { RunnerArgs } from "@effing/fn";
import {
  deserializeError,
  serializeError,
  type FnPaths,
  type FromWorker,
  type SerializedError,
  type ToWorker,
} from "./annie-protocol";

export type AnniePoolOptions = {
  /** Upper bound on worker threads, spawned on demand. */
  size: number;
  /** Path of the built worker entry (`annie-worker.js`). */
  workerFile: string;
  /**
   * Answers a worker's Vite module runner request — in the dev server, the
   * SSR environment's `hot.handleInvoke`, so workers share its transforms.
   */
  invoke: (payload: unknown) => Promise<unknown>;
  /** Current fn paths, so `fnModule()` inside a worker sees the same fns. */
  fnPaths: () => FnPaths;
};

export type AnniePool = {
  /** Run the annie fn at `absPath` on a worker, streaming its frames back. */
  run(absPath: string, args: RunnerArgs<unknown>): AsyncGenerator<Buffer>;
  /**
   * Make workers re-evaluate fns on their next job. Call when a source file
   * changes: Vite tracks staleness per module, not per runner, so once the
   * main thread re-imports an edited fn, the server would tell workers that
   * their cached copy is current.
   */
  invalidate(): void;
  close(): Promise<void>;
};

/**
 * Buffers a job's replies until its generator asks for them: with read-ahead
 * a frame can arrive before the previous one has been consumed.
 */
class JobInbox {
  private queue: JobReply[] = [];
  private waiter?: (reply: JobReply) => void;

  push(reply: JobReply): void {
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = undefined;
      waiter(reply);
    } else {
      this.queue.push(reply);
    }
  }

  take(): Promise<JobReply> {
    const reply = this.queue.shift();
    if (reply) return Promise.resolve(reply);
    return new Promise((resolve) => (this.waiter = resolve));
  }
}

type JobReply = Extract<FromWorker, { job: number }>;

type Slot = { worker: Worker; jobs: Map<number, JobInbox> };

/**
 * A pool of worker threads that run annie fns, so several annies (e.g. the
 * layers of one effie, which FFS fetches concurrently) render in parallel
 * instead of taking turns on the main thread.
 *
 * Workers are spawned lazily, up to `size`. A job goes to an idle worker,
 * else a new one, else the least busy — jobs are never queued, since an annie
 * that fetches another fn's output from this server would otherwise deadlock
 * once every worker waits on a queued job.
 */
export function createAnniePool(options: AnniePoolOptions): AnniePool {
  const slots: Slot[] = [];
  let nextJob = 0;
  let closed = false;

  const spawn = (): Slot => {
    // SHARE_ENV: fns read process.env, and BASE_URL is set after the server
    // starts (by `effing render`), so a copy taken at spawn could be stale.
    const worker = new Worker(options.workerFile, { env: SHARE_ENV });
    const slot: Slot = { worker, jobs: new Map() };

    worker.on("message", (msg: FromWorker) => {
      if (msg.type === "invoke") {
        const reply = (result: unknown) => {
          try {
            post(worker, { type: "invoke-result", id: msg.id, result });
          } catch (err) {
            // A transform error can carry fields that can't be cloned; keep
            // its name, message and stack rather than the clone failure.
            const original = (result as { error?: SerializedError }).error;
            post(worker, {
              type: "invoke-result",
              id: msg.id,
              result: {
                error: original
                  ? {
                      name: String(original.name),
                      message: String(original.message),
                      stack: original.stack && String(original.stack),
                    }
                  : serializeError(err),
              },
            });
          }
        };
        void options
          .invoke(msg.payload)
          .then(reply, (err: unknown) => reply({ error: serializeError(err) }));
        return;
      }
      slot.jobs.get(msg.job)?.push(msg);
    });

    // An uncaught error or exit takes the worker's jobs down with it; drop
    // the slot so later jobs go to a fresh worker.
    const fail = (error: SerializedError) => {
      const index = slots.indexOf(slot);
      if (index !== -1) slots.splice(index, 1);
      for (const [job, inbox] of slot.jobs) {
        inbox.push({ type: "error", job, error });
      }
      slot.jobs.clear();
    };
    worker.on("error", (err) => fail(serializeError(err)));
    worker.on("exit", (code) =>
      fail({
        name: "Error",
        message: `annie worker exited with code ${code}`,
      }),
    );

    slots.push(slot);
    return slot;
  };

  const acquire = (): Slot => {
    const idle = slots.find((s) => s.jobs.size === 0);
    if (idle) return idle;
    if (slots.length < options.size) return spawn();
    return slots.reduce((a, b) => (b.jobs.size < a.jobs.size ? b : a));
  };

  async function* run(
    absPath: string,
    args: RunnerArgs<unknown>,
  ): AsyncGenerator<Buffer> {
    if (closed) throw new Error("annie pool is closed");
    const slot = acquire();
    const job = nextJob++;
    const inbox = new JobInbox();
    slot.jobs.set(job, inbox);
    let finished = false;
    try {
      // Props cross a thread boundary, so they must be structured-cloneable;
      // a DataCloneError surfaces here as the render's error.
      post(slot.worker, {
        type: "start",
        job,
        absPath,
        args,
        fnPaths: options.fnPaths(),
      });
      while (true) {
        const reply = await inbox.take();
        if (reply.type === "done") {
          finished = true;
          return;
        }
        if (reply.type === "error") {
          finished = true;
          throw deserializeError(reply.error);
        }
        // Ask for the next frame before handing this one over, so the worker
        // renders frame n+1 while the consumer is busy with frame n.
        post(slot.worker, { type: "next", job });
        yield Buffer.from(
          reply.frame.buffer,
          reply.frame.byteOffset,
          reply.frame.byteLength,
        );
      }
    } finally {
      slot.jobs.delete(job);
      if (!finished) post(slot.worker, { type: "cancel", job });
    }
  }

  return {
    run,
    invalidate() {
      for (const slot of slots) post(slot.worker, { type: "invalidate" });
    },
    async close() {
      closed = true;
      await Promise.all(slots.map((s) => s.worker.terminate()));
      slots.length = 0;
    },
  };
}

function post(worker: Worker, msg: ToWorker): void {
  worker.postMessage(msg);
}
