import { MessageChannel, type MessagePort } from "node:worker_threads";
import { afterEach, describe, expect, test } from "vitest";
import { serveAnnieJobs, type AnnieRunner } from "./annie-jobs";
import type { FnPaths, FromWorker, ToWorker } from "./annie-protocol";

const fnPaths: FnPaths = { image: {}, annie: {}, effie: {} };
const args = { props: {}, bounds: { width: 1, height: 1 } };

let channel: MessageChannel;

afterEach(() => {
  channel?.port1.close();
});

/** Serve jobs on one end of a channel; drive them from the other. */
function serve(runners: Record<string, AnnieRunner>) {
  channel = new MessageChannel();
  serveAnnieJobs(channel.port1 as MessagePort, async (absPath) => {
    const runner = runners[absPath];
    if (!runner) throw new Error(`no annie at ${absPath}`);
    return runner;
  });
  const main = channel.port2;
  const replies: FromWorker[] = [];
  let notify = () => {};
  main.on("message", (msg: FromWorker) => {
    replies.push(msg);
    notify();
  });
  const reply = async (): Promise<FromWorker> => {
    while (replies.length === 0) {
      await new Promise<void>((resolve) => (notify = resolve));
    }
    return replies.shift()!;
  };
  const send = (msg: ToWorker) => main.postMessage(msg);
  return { send, reply, replies };
}

async function* frames(count: number): AsyncGenerator<Buffer> {
  for (let i = 0; i < count; i++) yield Buffer.from([i]);
}

describe("serveAnnieJobs", () => {
  test("streams one frame per request, then reports done", async () => {
    const { send, reply } = serve({ "/a": () => frames(2) });

    send({ type: "start", job: 1, absPath: "/a", args, fnPaths });
    expect(await reply()).toMatchObject({ type: "frame", job: 1 });
    send({ type: "next", job: 1 });
    const second = await reply();
    expect(second).toMatchObject({ type: "frame", job: 1 });
    expect([...(second as { frame: Uint8Array }).frame]).toEqual([1]);
    send({ type: "next", job: 1 });
    expect(await reply()).toEqual({ type: "done", job: 1 });
  });

  test("sends a frame that is a view on a larger buffer as just its bytes", async () => {
    const pooled = Buffer.from([9, 1, 2, 3, 9]).subarray(1, 4);
    const { send, reply } = serve({
      "/a": async function* () {
        yield pooled;
      },
    });

    send({ type: "start", job: 1, absPath: "/a", args, fnPaths });
    const msg = (await reply()) as { frame: Uint8Array };
    expect([...msg.frame]).toEqual([1, 2, 3]);
  });

  test("reports a module that fails to load", async () => {
    const { send, reply } = serve({});

    send({ type: "start", job: 1, absPath: "/missing", args, fnPaths });
    expect(await reply()).toMatchObject({
      type: "error",
      job: 1,
      error: { message: "no annie at /missing" },
    });
  });

  test("reports an error thrown mid-stream", async () => {
    const { send, reply } = serve({
      "/a": async function* () {
        yield Buffer.from([0]);
        throw new TypeError("boom");
      },
    });

    send({ type: "start", job: 1, absPath: "/a", args, fnPaths });
    await reply();
    send({ type: "next", job: 1 });
    expect(await reply()).toMatchObject({
      type: "error",
      job: 1,
      error: { name: "TypeError", message: "boom" },
    });
  });

  test("cancel closes the frame iterator and stops the job", async () => {
    let closed = false;
    const { send, reply, replies } = serve({
      "/a": async function* () {
        try {
          for (let i = 0; ; i++) yield Buffer.from([i]);
        } finally {
          closed = true;
        }
      },
    });

    send({ type: "start", job: 1, absPath: "/a", args, fnPaths });
    await reply();
    send({ type: "cancel", job: 1 });
    send({ type: "next", job: 1 });
    await expect.poll(() => closed).toBe(true);
    expect(replies).toEqual([]);
  });

  test("runs jobs side by side", async () => {
    const { send, reply } = serve({
      "/a": () => frames(1),
      "/b": () => frames(1),
    });

    send({ type: "start", job: 1, absPath: "/a", args, fnPaths });
    send({ type: "start", job: 2, absPath: "/b", args, fnPaths });
    const jobs = [await reply(), await reply()].map((m) =>
      "job" in m ? m.job : undefined,
    );
    expect(jobs.sort()).toEqual([1, 2]);
  });
});
