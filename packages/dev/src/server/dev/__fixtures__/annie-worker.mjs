// Stand-in for annie-worker.ts in annie-pool tests, speaking the same
// protocol. The job's absPath picks a behaviour:
//   count:N   N frames, each one byte: the frame index
//   thread    one frame holding this worker's threadId
//   fail      one frame, then an error
//   crash     exits the worker
//   endless   frames until cancelled
//   cancels   one frame holding how many jobs this worker saw cancelled
//   invoke    one frame holding the JSON result of an invoke round-trip
import { Buffer } from "node:buffer";
import process from "node:process";
import { parentPort, threadId } from "node:worker_threads";

const jobs = new Map();
let cancels = 0;
let nextInvoke = 0;
const invokes = new Map();

const frame = (job, bytes) => {
  const data = Uint8Array.from(bytes);
  parentPort.postMessage({ type: "frame", job, frame: data }, [data.buffer]);
};

const invoke = (payload) =>
  new Promise((resolve) => {
    const id = nextInvoke++;
    invokes.set(id, resolve);
    parentPort.postMessage({ type: "invoke", id, payload });
  });

async function* behaviour(name) {
  if (name.startsWith("count:")) {
    for (let i = 0; i < Number(name.slice(6)); i++) yield [i];
  } else if (name === "thread") {
    yield [threadId];
  } else if (name === "fail") {
    yield [0];
    throw new RangeError("fixture failure");
  } else if (name === "crash") {
    process.exit(3);
  } else if (name === "endless") {
    for (let i = 0; ; i++) yield [i % 256];
  } else if (name === "cancels") {
    yield [cancels];
  } else if (name === "invoke") {
    const result = await invoke({ hello: "vite" });
    yield [...Buffer.from(JSON.stringify(result))];
  }
}

const step = async (job) => {
  const it = jobs.get(job);
  try {
    const { value, done } = await it.next();
    if (!jobs.has(job)) return;
    if (done) {
      jobs.delete(job);
      parentPort.postMessage({ type: "done", job });
    } else {
      frame(job, value);
    }
  } catch (err) {
    jobs.delete(job);
    parentPort.postMessage({
      type: "error",
      job,
      error: { name: err.name, message: err.message, stack: err.stack },
    });
  }
};

parentPort.on("message", (msg) => {
  if (msg.type === "invoke-result") {
    invokes.get(msg.id)(msg.result);
  } else if (msg.type === "start") {
    jobs.set(msg.job, behaviour(msg.absPath));
    void step(msg.job);
  } else if (msg.type === "next") {
    if (jobs.has(msg.job)) void step(msg.job);
  } else if (msg.type === "cancel") {
    if (jobs.delete(msg.job)) cancels++;
  }
});
