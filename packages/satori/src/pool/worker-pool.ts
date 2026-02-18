import { Worker, type WorkerOptions } from "node:worker_threads";
import { pathToFileURL } from "node:url";

interface Task {
  id: number;
  name: string;
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

interface WorkerEntry {
  worker: Worker;
  busy: boolean;
}

export interface WorkerPoolOptions {
  workerFile: string;
  minThreads?: number;
  maxThreads?: number;
}

// CJS bootstrap that dynamically imports the ESM worker module, then
// wires up parentPort message handling for { id, name, args } calls.
const BOOTSTRAP = `
"use strict";
const { parentPort, workerData } = require("node:worker_threads");

const modPromise = import(workerData.workerUrl)
  .catch((err) => {
    parentPort.postMessage({
      id: -1,
      error: { name: "InitError", message: err.message, stack: err.stack },
    });
    process.exit(1);
  });

parentPort.on("message", async (msg) => {
  const { id, name, args } = msg;
  try {
    const mod = await modPromise;
    const result = await mod[name](...args);
    parentPort.postMessage({ id, result });
  } catch (err) {
    parentPort.postMessage({
      id,
      error: {
        name: err?.name ?? "Error",
        message: err?.message ?? String(err),
        stack: err?.stack,
        code: err?.code,
      },
    });
  }
});
`.trim();

export class WorkerPool {
  private readonly workerUrl: string;
  private readonly workerOpts: WorkerOptions;
  private readonly minThreads: number;
  private readonly maxThreads: number;
  private readonly workers: WorkerEntry[] = [];
  private readonly queue: Task[] = [];
  private nextId = 0;
  private destroyed = false;

  constructor(options: WorkerPoolOptions) {
    this.workerUrl = pathToFileURL(options.workerFile).href;
    this.minThreads = options.minThreads ?? 1;
    this.maxThreads = options.maxThreads ?? 1;
    this.workerOpts = {
      eval: true,
      workerData: { workerUrl: this.workerUrl },
    };

    // Pre-spawn minimum workers
    for (let i = 0; i < this.minThreads; i++) {
      this.workers.push(this.spawnWorker());
    }
  }

  run(args: unknown, options: { name: string }): Promise<unknown> {
    if (this.destroyed) {
      return Promise.reject(new Error("WorkerPool has been destroyed"));
    }

    return new Promise<unknown>((resolve, reject) => {
      const task: Task = {
        id: this.nextId++,
        name: options.name,
        args: [args],
        resolve,
        reject,
      };
      this.dispatch(task);
    });
  }

  async destroy(): Promise<void> {
    this.destroyed = true;

    // Reject all queued tasks
    for (const task of this.queue) {
      task.reject(new Error("WorkerPool has been destroyed"));
    }
    this.queue.length = 0;

    // Terminate all workers
    await Promise.all(this.workers.map((entry) => entry.worker.terminate()));
    this.workers.length = 0;
  }

  private dispatch(task: Task): void {
    // Find an idle worker
    const idle = this.workers.find((w) => !w.busy);
    if (idle) {
      this.sendToWorker(idle, task);
      return;
    }

    // Spawn a new worker if under the max
    if (this.workers.length < this.maxThreads) {
      const entry = this.spawnWorker();
      this.workers.push(entry);
      this.sendToWorker(entry, task);
      return;
    }

    // All workers busy, queue the task
    this.queue.push(task);
  }

  private sendToWorker(entry: WorkerEntry, task: Task): void {
    entry.busy = true;

    const onMessage = (msg: {
      id: number;
      result?: unknown;
      error?: { name: string; message: string; stack?: string; code?: string };
    }) => {
      if (msg.id !== task.id) return;
      entry.worker.off("message", onMessage);
      entry.worker.off("error", onError);
      entry.busy = false;

      if (msg.error) {
        const err = new Error(msg.error.message);
        err.name = msg.error.name;
        if (msg.error.stack) err.stack = msg.error.stack;
        if (msg.error.code)
          (err as NodeJS.ErrnoException).code = msg.error.code;
        task.reject(err);
      } else {
        task.resolve(msg.result);
      }

      this.processQueue();
    };

    const onError = (err: Error) => {
      entry.worker.off("message", onMessage);
      entry.worker.off("error", onError);
      entry.busy = false;
      task.reject(err);
      this.processQueue();
    };

    entry.worker.on("message", onMessage);
    entry.worker.on("error", onError);

    entry.worker.postMessage({ id: task.id, name: task.name, args: task.args });
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;
    const idle = this.workers.find((w) => !w.busy);
    if (idle) {
      const task = this.queue.shift()!;
      this.sendToWorker(idle, task);
    }
  }

  private spawnWorker(): WorkerEntry {
    const worker = new Worker(BOOTSTRAP, this.workerOpts);
    const entry: WorkerEntry = { worker, busy: false };

    worker.on("exit", (code) => {
      const idx = this.workers.indexOf(entry);
      if (idx !== -1) this.workers.splice(idx, 1);

      // Auto-restart on unexpected exit (not from destroy)
      if (!this.destroyed && code !== 0) {
        this.workers.push(this.spawnWorker());
      }
    });

    // Handle init errors (id === -1 from bootstrap)
    worker.on(
      "message",
      (msg: {
        id: number;
        error?: { name: string; message: string; stack?: string };
      }) => {
        if (msg.id === -1 && msg.error) {
          const err = new Error(msg.error.message);
          err.name = msg.error.name;
          if (msg.error.stack) err.stack = msg.error.stack;
          // Worker will exit(1) after this, triggering auto-restart
        }
      },
    );

    return entry;
  }
}
