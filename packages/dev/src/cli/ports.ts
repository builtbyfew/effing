import net from "node:net";

export const MAX_PORT_ATTEMPTS = 16;

/**
 * Find a free TCP port, probing sequentially from `start`.
 *
 * Each port is probed on both the wildcard address and loopback: with
 * SO_REUSEADDR (Node's default), macOS lets a bind on one of those succeed
 * while another process holds the other, so a single-address probe
 * under-reports. The consumer (the FFS sidecar) binds the wildcard but is
 * reached via loopback, so both must actually be ours.
 *
 * Probe-then-bind is inherently racy (another process can grab the port
 * between the probe and the real listen), so this is only used where we hand
 * the port to a child process and can't bind-with-retry ourselves — the dev
 * server itself retries on the actual listen instead.
 */
export async function findFreePort(
  start: number,
  attempts = MAX_PORT_ATTEMPTS,
): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const port = start + i;
    if ((await probe(port)) && (await probe(port, "127.0.0.1"))) return port;
  }
  throw new Error(
    `No free port found in range ${start}–${start + attempts - 1}.`,
  );
}

function probe(port: number, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    const onListen = () => server.close(() => resolve(true));
    if (host) server.listen(port, host, onListen);
    else server.listen(port, onListen);
  });
}
