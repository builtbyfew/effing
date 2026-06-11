import net from "node:net";
import { describe, expect, it } from "vitest";
import { findFreePort } from "./ports";

function occupyPort(
  host?: string,
): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = net.createServer();
    const onListen = () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ port, close: () => server.close() });
    };
    if (host) server.listen(0, host, onListen);
    else server.listen(0, onListen);
  });
}

describe("findFreePort", () => {
  it("returns the start port when it is free", async () => {
    const { port, close } = await occupyPort();
    close();
    // The just-released port is free again.
    await expect(findFreePort(port)).resolves.toBe(port);
  });

  it("skips past an occupied port", async () => {
    const { port, close } = await occupyPort();
    try {
      const free = await findFreePort(port);
      expect(free).toBeGreaterThan(port);
    } finally {
      close();
    }
  });

  it("detects ports held on a specific address, not just the wildcard", async () => {
    // A loopback-only listener must still mark the port as taken — the
    // consumer binds the wildcard address, which such a listener blocks.
    const { port, close } = await occupyPort("127.0.0.1");
    try {
      const free = await findFreePort(port);
      expect(free).toBeGreaterThan(port);
    } finally {
      close();
    }
  });

  it("throws when no port in the range is free", async () => {
    const { port, close } = await occupyPort();
    try {
      await expect(findFreePort(port, 1)).rejects.toThrow(/No free port found/);
    } finally {
      close();
    }
  });
});
