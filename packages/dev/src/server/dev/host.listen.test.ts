import http from "node:http";
import net from "node:net";
import { describe, expect, it } from "vitest";
import { listenWithRetry } from "./host";

const HOST = "127.0.0.1";

function listen(port: number): Promise<net.Server | undefined> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(undefined));
    server.listen(port, HOST, () => resolve(server));
  });
}

function close(server: net.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Hold `count` consecutive ports open, and make sure the port right after
 * them is free. Starts from an OS-assigned port and tries again elsewhere
 * when a port in the run turns out to be taken.
 */
async function occupyRun(
  count: number,
): Promise<{ base: number; close: () => Promise<void> }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const first = await listen(0);
    if (!first) continue;
    const base = (first.address() as net.AddressInfo).port;
    const held = [first];
    for (let i = 1; i <= count && base + i <= 65535; i++) {
      const server = await listen(base + i);
      if (!server) break;
      held.push(server);
    }
    // One more than needed: the last one only proves the next port is free.
    if (held.length === count + 1) {
      await close(held.pop()!);
      return {
        base,
        close: async () => {
          await Promise.all(held.map(close));
        },
      };
    }
    await Promise.all(held.map(close));
  }
  throw new Error(`Could not find ${count + 1} consecutive free ports.`);
}

function listenerCounts(server: http.Server) {
  return {
    listening: server.listenerCount("listening"),
    error: server.listenerCount("error"),
  };
}

/**
 * Snapshot the listener counts each time an attempt starts (registers its
 * `error` listener), i.e. what the attempts before it left behind. A
 * successful listen fires and drops leaked `listening` callbacks, so the
 * counts after the walk alone wouldn't show a leak.
 */
function countsPerAttempt(server: http.Server) {
  const snapshots: ReturnType<typeof listenerCounts>[] = [];
  server.on("newListener", (event) => {
    if (event === "error") snapshots.push(listenerCounts(server));
  });
  return snapshots;
}

describe("listenWithRetry", () => {
  it("walks past taken ports without leaking listeners", async () => {
    // More than EventEmitter's default limit of 10 listeners, so a leak
    // would also trigger MaxListenersExceededWarning.
    const taken = 11;
    const run = await occupyRun(taken);
    const server = http.createServer();
    const before = listenerCounts(server);
    const snapshots = countsPerAttempt(server);
    try {
      const port = await listenWithRetry(server, HOST, run.base, false);
      // Usually exactly `run.base + taken`, but another process may grab that
      // port after `occupyRun` frees it, sending the walk further up.
      expect(port).toBeGreaterThanOrEqual(run.base + taken);
      expect((server.address() as net.AddressInfo).port).toBe(port);
      expect(snapshots.length).toBeGreaterThanOrEqual(taken + 1);
      for (const snapshot of snapshots) expect(snapshot).toEqual(before);
      expect(listenerCounts(server)).toEqual(before);
    } finally {
      if (server.listening) await close(server);
      await run.close();
    }
  });

  it("leaves no listeners behind when a strict listen fails", async () => {
    const run = await occupyRun(1);
    const server = http.createServer();
    const before = listenerCounts(server);
    try {
      await expect(
        listenWithRetry(server, HOST, run.base, true),
      ).rejects.toThrow(/already in use/);
      expect(listenerCounts(server)).toEqual(before);
    } finally {
      await run.close();
    }
  });
});
