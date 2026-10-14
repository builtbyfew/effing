import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createAnniePool, type AnniePool } from "./annie-pool";

const workerFile = fileURLToPath(
  new URL("./__fixtures__/annie-worker.mjs", import.meta.url),
);
const args = { props: {}, bounds: { width: 1, height: 1 } };

let pool: AnniePool | undefined;

afterEach(async () => {
  await pool?.close();
  pool = undefined;
});

function createPool(
  size: number,
  invoke: (payload: unknown) => Promise<unknown> = async () => ({}),
): AnniePool {
  pool = createAnniePool({
    size,
    workerFile,
    invoke,
    fnPaths: () => ({ image: {}, annie: {}, effie: {} }),
  });
  return pool;
}

async function collect(frames: AsyncIterable<Buffer>): Promise<number[][]> {
  const out: number[][] = [];
  for await (const frame of frames) out.push([...frame]);
  return out;
}

describe("createAnniePool", () => {
  test("streams a job's frames in order", async () => {
    const pool = createPool(2);
    expect(await collect(pool.run("count:3", args))).toEqual([[0], [1], [2]]);
  });

  test("runs concurrent jobs on separate workers", async () => {
    const pool = createPool(2);
    // Each job claims its worker on its first pull, so the second job finds
    // the first worker busy.
    const ids = await Promise.all([
      collect(pool.run("thread", args)),
      collect(pool.run("thread", args)),
    ]);
    expect(new Set(ids.flat(2)).size).toBe(2);
  });

  test("never spawns more than `size` workers, nor queues jobs", async () => {
    const pool = createPool(1);
    const busy = pool.run("endless", args);
    await busy.next();
    // A second job shares the only worker instead of waiting for the first.
    expect(await collect(pool.run("count:2", args))).toEqual([[0], [1]]);
    const ids = await Promise.all([
      collect(pool.run("thread", args)),
      collect(pool.run("thread", args)),
    ]);
    expect(new Set(ids.flat(2)).size).toBe(1);
    await busy.return(undefined);
  });

  test("rethrows a job's error with its name and message", async () => {
    const pool = createPool(1);
    const err = await collect(pool.run("fail", args)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({
      name: "RangeError",
      message: "fixture failure",
    });
  });

  test("cancels the worker's job when the consumer stops early", async () => {
    const pool = createPool(1);
    for await (const frame of pool.run("endless", args)) {
      if (frame[0] === 2) break;
    }
    await vi.waitFor(async () => {
      expect(await collect(pool.run("cancels", args))).toEqual([[1]]);
    });
  });

  test("fails a crashed worker's jobs and replaces the worker", async () => {
    const pool = createPool(1);
    await expect(collect(pool.run("crash", args))).rejects.toThrow(
      "annie worker exited with code 3",
    );
    expect(await collect(pool.run("count:1", args))).toEqual([[0]]);
  });

  test("blames a worker's uncaught error on the worker, not on each job", async () => {
    const pool = createPool(1);
    const err = await collect(pool.run("uncaught", args)).catch(
      (e: unknown) => e,
    );
    expect((err as Error).message).toBe(
      "annie worker crashed, in this or another annie it was running: thrown outside the job",
    );
    expect(await collect(pool.run("count:1", args))).toEqual([[0]]);
  });

  test("refuses props that wouldn't reach the worker as they are, before starting", () => {
    const pool = createPool(1);
    class Size {
      constructor(readonly n: number) {}
    }
    const withProps = (props: unknown) => () =>
      pool.run("count:1", { ...args, props });
    expect(withProps({ size: new Size(2) })).toThrow(
      "but props.size is a Size, which arrives as a plain object",
    );
    expect(withProps({ list: [1, { f: () => 0 }] })).toThrow(
      "but props.list[1].f is a function",
    );
    expect(withProps({ data: Buffer.from("x") })).toThrow(
      "but props.data is a Buffer",
    );
    expect(withProps({ m: new Map([["k", new Size(1)]]) })).toThrow(
      "but props.m.get(k) is a Size",
    );
  });

  test("accepts props made of plain data", async () => {
    const pool = createPool(1);
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    const props = {
      text: "hi",
      n: 1,
      on: true,
      none: null,
      nested: [{ at: new Date(0) }],
      map: new Map([["k", 1]]),
      set: new Set(["a"]),
      bytes: new Uint8Array(2),
      pattern: /x/,
      bare: Object.create(null) as object,
      cyclic,
    };
    expect(await collect(pool.run("count:1", { ...args, props }))).toEqual([
      [0],
    ]);
  });

  test("answers a worker's module runner requests", async () => {
    const invoke = vi.fn(async (payload: unknown) => ({ result: payload }));
    const pool = createPool(1, invoke);
    const [bytes] = await collect(pool.run("invoke", args));
    expect(JSON.parse(Buffer.from(bytes).toString())).toEqual({
      result: { hello: "vite" },
    });
    expect(invoke).toHaveBeenCalledWith({ hello: "vite" });
  });

  test("reports a failed module runner request as an invoke error", async () => {
    const pool = createPool(1, async () => {
      throw new Error("transform failed");
    });
    const [bytes] = await collect(pool.run("invoke", args));
    expect(JSON.parse(Buffer.from(bytes).toString())).toMatchObject({
      error: { message: "transform failed" },
    });
  });

  test("rejects jobs once closed", async () => {
    const pool = createPool(1);
    await pool.close();
    expect(() => pool.run("count:1", args)).toThrow("annie pool is closed");
  });
});
