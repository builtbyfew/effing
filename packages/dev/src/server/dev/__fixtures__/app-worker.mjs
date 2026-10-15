// A stand-in for app-worker.ts in app-workers.test.ts: speaks the same
// protocol, but serves a few test routes instead of the dev app.
import http from "node:http";
import { parentPort, threadId, workerData } from "node:worker_threads";

if (workerData.failStart) throw new Error("worker failed to start");

let fns = workerData.fns;
const invalidated = [];
let nextInvoke = 0;
const pendingInvokes = new Map();

parentPort.on("message", (msg) => {
  if (msg.type === "invoke-result") {
    pendingInvokes.get(msg.id)?.(msg.result);
    pendingInvokes.delete(msg.id);
  } else if (msg.type === "invalidate") {
    invalidated.push(msg.file);
  } else if (msg.type === "fns") {
    fns = msg.fns;
  }
});

const invoke = (payload) =>
  new Promise((resolve) => {
    const id = nextInvoke++;
    pendingInvokes.set(id, resolve);
    parentPort.postMessage({ type: "invoke", id, payload });
  });

const json = (res, value) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  switch (url.pathname) {
    case "/state":
      // Waits first, if asked to, so that requests made together overlap.
      await new Promise((resolve) =>
        setTimeout(resolve, Number(url.searchParams.get("ms") ?? 0)),
      );
      json(res, { thread: threadId, fns, invalidated });
      return;
    case "/echo": {
      let body = "";
      for await (const chunk of req) body += chunk;
      res.writeHead(201, "Made", {
        "X-Echo": req.headers["x-test"] ?? "",
        "Set-Cookie": ["a=1", "b=2"],
      });
      res.end(`${req.method} ${body}`);
      return;
    }
    case "/hold":
      // Streams until the client goes away, then says so.
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("first");
      res.on(
        "close",
        () => void invoke({ aborted: url.searchParams.get("id") }),
      );
      return;
    case "/crash":
      setTimeout(() => {
        throw new Error("fn blew up");
      });
      return;
    case "/crash-midway":
      // Starts the response, then crashes.
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("first");
      setTimeout(() => {
        throw new Error("fn blew up midway");
      }, 50);
      return;
    case "/invoke":
      json(res, await invoke(url.searchParams.get("payload")));
      return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(0, "127.0.0.1", () => {
  parentPort.postMessage({ type: "ready", port: server.address().port });
});
