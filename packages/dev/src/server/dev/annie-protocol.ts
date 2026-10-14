import type { RunnerArgs } from "@effing/fn";
import type { FnKind } from "../../fns";

// Messages between the dev server and its annie workers (see annie-pool.ts
// and annie-worker.ts).

/** Absolute paths of every fn, by kind and id. */
export type FnPaths = Record<FnKind, Record<string, string>>;

export type SerializedError = { name: string; message: string; stack?: string };

/** Messages the main thread sends to an annie worker. */
export type ToWorker =
  | {
      type: "start";
      job: number;
      absPath: string;
      args: RunnerArgs<unknown>;
      fnPaths: FnPaths;
    }
  | { type: "next"; job: number }
  | { type: "cancel"; job: number }
  | { type: "invalidate"; file: string }
  | { type: "invoke-result"; id: number; result: unknown };

/** Messages an annie worker sends to the main thread. */
export type FromWorker =
  | { type: "frame"; job: number; frame: Uint8Array }
  | { type: "done"; job: number }
  | { type: "error"; job: number; error: SerializedError }
  | { type: "invoke"; id: number; payload: unknown };

export function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "Error", message: String(err) };
}

export function deserializeError(error: SerializedError): Error {
  const err = new Error(error.message);
  err.name = error.name;
  if (error.stack) err.stack = error.stack;
  return err;
}
