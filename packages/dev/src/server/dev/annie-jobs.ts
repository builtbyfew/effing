import type { MessagePort } from "node:worker_threads";
import type { RunnerArgs } from "@effing/fn";
import {
  serializeError,
  type FnPaths,
  type FromWorker,
  type ToWorker,
} from "./annie-protocol";

export type AnnieRunner = (args: RunnerArgs<unknown>) => AsyncIterable<Buffer>;

/**
 * The worker side of the annie pool: runs the jobs the main thread starts on
 * `port`, advancing each job's frame iterator one frame per request.
 *
 * `load` resolves the annie fn at an absolute path to its runner.
 */
export function serveAnnieJobs(
  port: MessagePort,
  load: (absPath: string, fnPaths: FnPaths) => Promise<AnnieRunner>,
): void {
  // A job is present from "start" until it finishes or is cancelled; its
  // iterator is null while the fn module is still loading.
  const jobs = new Map<number, AsyncIterator<Buffer> | null>();

  const post = (msg: FromWorker, transfer: ArrayBuffer[] = []) =>
    port.postMessage(msg, transfer);

  const fail = (job: number, err: unknown) => {
    if (!jobs.delete(job)) return;
    post({ type: "error", job, error: serializeError(err) });
  };

  const step = async (job: number, frames: AsyncIterator<Buffer>) => {
    let result: IteratorResult<Buffer>;
    try {
      result = await frames.next();
    } catch (err) {
      fail(job, err);
      return;
    }
    if (!jobs.has(job)) return; // cancelled while rendering
    if (result.done) {
      jobs.delete(job);
      post({ type: "done", job });
      return;
    }
    // Copy into an ArrayBuffer of its own to transfer it: the frame may be a
    // view on a larger (pooled) buffer, or on native memory that can't be
    // transferred.
    const frame = new Uint8Array(result.value.byteLength);
    frame.set(result.value);
    post({ type: "frame", job, frame }, [frame.buffer]);
  };

  const start = async (msg: Extract<ToWorker, { type: "start" }>) => {
    let frames: AsyncIterator<Buffer>;
    try {
      const runner = await load(msg.absPath, msg.fnPaths);
      frames = runner(msg.args)[Symbol.asyncIterator]();
    } catch (err) {
      fail(msg.job, err);
      return;
    }
    if (!jobs.has(msg.job)) {
      void frames.return?.(undefined)?.catch(() => {});
      return;
    }
    jobs.set(msg.job, frames);
    await step(msg.job, frames);
  };

  port.on("message", (msg: ToWorker) => {
    switch (msg.type) {
      case "start":
        jobs.set(msg.job, null);
        void start(msg);
        break;
      case "next": {
        const frames = jobs.get(msg.job);
        if (frames) void step(msg.job, frames);
        break;
      }
      case "cancel": {
        const frames = jobs.get(msg.job);
        jobs.delete(msg.job);
        void frames?.return?.(undefined)?.catch(() => {});
        break;
      }
    }
  });
}
