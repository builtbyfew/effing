import { test, expect } from "vitest";
import { steps } from "./steps";

test("steps count=0 returns empty array", () => {
  expect(steps(0)).toStrictEqual([]);
});

test("steps count=1 returns [0]", () => {
  expect(steps(1)).toStrictEqual([0]);
});

test("steps count=4 returns quarters (lower bounds)", () => {
  expect(steps(4)).toStrictEqual([0, 0.25, 0.5, 0.75]);
});

test("steps monotonicity and bounds", () => {
  const r = steps(10);
  expect(r.length).toBe(10);
  for (let i = 0; i < r.length; i++) {
    expect(r[i]).toBeGreaterThanOrEqual(0);
    expect(r[i]).toBeLessThan(1);
    if (i > 0) expect(r[i]).toBeGreaterThan(r[i - 1]);
  }
});
