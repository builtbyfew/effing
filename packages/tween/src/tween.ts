import os from "os";
import { steps } from "./steps";

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
 * @param options Configuration options
 * @yields Resulting frames in order
 */
export async function* tween<T>(
  count: number,
  fn: (interval: TweenInterval, index: number) => Promise<T>,
  options: { concurrency?: number } = { concurrency: os.cpus().length },
): AsyncGenerator<T> {
  if (count === 0) {
    return;
  }

  const range = steps(count);
  const maxConcurrency = Math.max(1, options.concurrency ?? os.cpus().length);
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
 * @param options Configuration options
 * @returns Promise resolving to array of resulting frames
 */
export async function tweenToArray<T>(
  count: number,
  fn: (interval: TweenInterval, index: number) => Promise<T>,
  options: { concurrency?: number } = { concurrency: os.cpus().length },
): Promise<T[]> {
  return Array.fromAsync(tween(count, fn, options));
}
