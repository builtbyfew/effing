import { test, expect } from "vitest";
import { tween, tweenToArray } from "./tween";

test("tweenToArray handles count = 0", async () => {
  const mapper = async () => 42;
  const arr = await tweenToArray(0, mapper);
  expect(arr).toStrictEqual([]);
});

test("tweenToArray handles count = 1", async () => {
  const mapper = async (
    { lower, upper }: { lower: number; upper: number },
    i: number,
  ) => ({ i, lower, upper });

  const expected = [{ i: 0, lower: 0, upper: 1 }];

  const arr = await tweenToArray(1, mapper, { concurrency: 8 });
  expect(arr).toStrictEqual(expected);
});

test("tweenToArray handles count = 4", async () => {
  const count = 4;
  const mapper = async (
    { lower, upper }: { lower: number; upper: number },
    i: number,
  ) => ({ i, lower, upper });

  const expected = [
    { i: 0, lower: 0, upper: 0.25 },
    { i: 1, lower: 0.25, upper: 0.5 },
    { i: 2, lower: 0.5, upper: 0.75 },
    { i: 3, lower: 0.75, upper: 1 },
  ];

  const arr = await tweenToArray(count, mapper, { concurrency: 2 });
  expect(arr).toStrictEqual(expected);
});

test("tweenToArray respects concurrency limit", async () => {
  const count = 20;
  const limit = 3;
  let inFlight = 0;
  let observedMax = 0;
  const mapper = async () => {
    inFlight++;
    if (inFlight > observedMax) observedMax = inFlight;
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return inFlight;
  };
  await tweenToArray(count, mapper, { concurrency: limit });
  expect(observedMax).toBeLessThanOrEqual(limit);
});

test("tween respects concurrency limit", async () => {
  const count = 20;
  const limit = 4;
  let inFlight = 0;
  let observedMax = 0;
  const mapper = async () => {
    inFlight++;
    if (inFlight > observedMax) observedMax = inFlight;
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return inFlight;
  };
  const sink1: unknown[] = [];
  for await (const v of tween(count, mapper, { concurrency: limit })) {
    sink1.push(v);
  }
  expect(sink1.length).toBe(count);
  expect(observedMax).toBeLessThanOrEqual(limit);
});

test("tweenToArray max concurrency is bounded by count", async () => {
  const count = 4;
  const limit = 10;
  let inFlight = 0;
  let observedMax = 0;
  const mapper = async () => {
    inFlight++;
    if (inFlight > observedMax) observedMax = inFlight;
    await new Promise((r) => setTimeout(r, 2));
    inFlight--;
    return inFlight;
  };
  await tweenToArray(count, mapper, { concurrency: limit });
  expect(observedMax).toBeLessThanOrEqual(count);
});

test("tween max concurrency is bounded by count", async () => {
  const count = 5;
  const limit = 10;
  let inFlight = 0;
  let observedMax = 0;
  const mapper = async () => {
    inFlight++;
    if (inFlight > observedMax) observedMax = inFlight;
    await new Promise((r) => setTimeout(r, 2));
    inFlight--;
    return inFlight;
  };
  const sink2: unknown[] = [];
  for await (const v of tween(count, mapper, { concurrency: limit })) {
    sink2.push(v);
  }
  expect(sink2.length).toBe(count);
  expect(observedMax).toBeLessThanOrEqual(count);
});
