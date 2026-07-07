import os from "os";
import { steps } from "./steps";

// Default concurrency: available cores, capped at 8. Frame callbacks are
// dominated by synchronous draw work on the JS main thread, which cannot run
// in parallel — extra concurrency only overlaps the async portions (e.g.
// native encoding on libuv's threadpool, which defaults to 4 threads).
// Benchmarks show throughput saturates around 4–8 in-flight frames, while
// in-order yielding retains one completed frame buffer per slot, so peak
// memory keeps growing with each extra slot. Pass `options.concurrency` to
// override (e.g. alongside a larger `UV_THREADPOOL_SIZE`).
const MAX_DEFAULT_CONCURRENCY = 8;
const defaultConcurrency = (): number =>
  Math.min(os.availableParallelism(), MAX_DEFAULT_CONCURRENCY);

/**
 * Tween interval representing a frame's position in the animation
 */
export type TweenInterval = {
  /** Lower bound (inclusive), in range [0, 1) */
  lower: number;
  /** Upper bound (exclusive for all but last frame), in range (0, 1] */
  upper: number;
};

/**
 * Tween frames with concurrency control
 * @param count Number of frames to generate
 * @param fn Function that takes a tween interval and index, returns a promise
 * @param options Configuration options; `concurrency` defaults to the number
 * of available cores capped at 8 (concurrency overlaps async work such as
 * encoding, not the synchronous draw)
 * @yields Resulting frames in order
 */
export async function* tween<T>(
  count: number,
  fn: (interval: TweenInterval, index: number) => Promise<T>,
  options: { concurrency?: number } = {
    concurrency: defaultConcurrency(),
  },
): AsyncGenerator<T> {
  if (count === 0) {
    return;
  }

  const range = steps(count);
  const maxConcurrency = Math.max(
    1,
    options.concurrency ?? defaultConcurrency(),
  );
  const activeTasks = new Map<number, Promise<T>>();

  let nextIndexToStart = 0;
  let nextIndexToYield = 0;

  const startTask = (index: number): void => {
    const lower = range[index];
    const upper = range[index + 1] ?? 1;
    const promise = fn({ lower, upper }, index);
    activeTasks.set(index, promise);
  };

  const fillConcurrencySlots = (): void => {
    while (nextIndexToStart < count && activeTasks.size < maxConcurrency) {
      startTask(nextIndexToStart++);
    }
  };

  fillConcurrencySlots();

  while (nextIndexToYield < count) {
    const taskPromise = activeTasks.get(nextIndexToYield);

    if (!taskPromise) {
      throw new Error(
        `Internal error: task at index ${nextIndexToYield} not found in active tasks`,
      );
    }

    const result = await taskPromise;
    activeTasks.delete(nextIndexToYield);
    yield result;

    fillConcurrencySlots();
    nextIndexToYield++;
  }
}

/**
 * Tween frames with concurrency control, returning an array
 * @param count Number of frames to generate
 * @param fn Function that takes a tween interval and index, returns a promise
 * @param options Configuration options; `concurrency` defaults to the number
 * of available cores capped at 8 (concurrency overlaps async work such as
 * encoding, not the synchronous draw)
 * @returns Promise resolving to array of resulting frames
 */
export async function tweenToArray<T>(
  count: number,
  fn: (interval: TweenInterval, index: number) => Promise<T>,
  options: { concurrency?: number } = {
    concurrency: defaultConcurrency(),
  },
): Promise<T[]> {
  return Array.fromAsync(tween(count, fn, options));
}
