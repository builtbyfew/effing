import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { HttpProxy } from "./proxy";

describe("HttpProxy", () => {
  let proxy: HttpProxy;

  beforeEach(() => {
    proxy = new HttpProxy();
  });

  afterEach(() => {
    proxy.close();
  });

  describe("port", () => {
    test("returns null before start", () => {
      expect(proxy.port).toBeNull();
    });

    test("returns port number after start", async () => {
      await proxy.start();
      expect(proxy.port).toBeTypeOf("number");
      expect(proxy.port).toBeGreaterThan(0);
    });
  });

  describe("start", () => {
    test("sets port after start", async () => {
      await proxy.start();
      expect(proxy.port).toBeTypeOf("number");
      expect(proxy.port).toBeGreaterThan(0);
    });

    test("only starts once on multiple calls", async () => {
      await proxy.start();
      const port1 = proxy.port;
      await proxy.start();
      const port2 = proxy.port;
      expect(port1).toBe(port2);
    });

    test("handles concurrent calls", async () => {
      await Promise.all([proxy.start(), proxy.start(), proxy.start()]);
      expect(proxy.port).toBeTypeOf("number");
      expect(proxy.port).toBeGreaterThan(0);
    });
  });

  describe("transformUrl", () => {
    test("throws if proxy not started", () => {
      expect(() => proxy.transformUrl("https://example.com")).toThrow(
        "Proxy not started",
      );
    });

    test("transforms HTTP URL", async () => {
      await proxy.start();
      const transformed = proxy.transformUrl("http://example.com/video.mp4");
      expect(transformed).toBe(
        `http://127.0.0.1:${proxy.port}/http://example.com/video.mp4`,
      );
    });

    test("transforms HTTPS URL", async () => {
      await proxy.start();
      const transformed = proxy.transformUrl(
        "https://cdn.example.com/path/to/stream.m3u8",
      );
      expect(transformed).toBe(
        `http://127.0.0.1:${proxy.port}/https://cdn.example.com/path/to/stream.m3u8`,
      );
    });

    test("preserves query parameters", async () => {
      await proxy.start();
      const transformed = proxy.transformUrl(
        "https://example.com/video.mp4?token=abc&t=123",
      );
      expect(transformed).toBe(
        `http://127.0.0.1:${proxy.port}/https://example.com/video.mp4?token=abc&t=123`,
      );
    });
  });

  describe("close", () => {
    test("resets port to null", async () => {
      await proxy.start();
      expect(proxy.port).not.toBeNull();
      proxy.close();
      expect(proxy.port).toBeNull();
    });

    test("can restart after close", async () => {
      await proxy.start();
      const port1 = proxy.port;
      proxy.close();
      await proxy.start();
      const port2 = proxy.port;
      // Ports may differ because port is reassigned
      expect(port1).toBeTypeOf("number");
      expect(port2).toBeTypeOf("number");
    });

    test("handles multiple close calls", () => {
      expect(() => {
        proxy.close();
        proxy.close();
        proxy.close();
      }).not.toThrow();
    });
  });

  describe("request handling", () => {
    test("rejects invalid proxy paths", async () => {
      await proxy.start();
      const response = await fetch(`http://127.0.0.1:${proxy.port}/not-a-url`);
      expect(response.status).toBe(400);
    });

    test("rejects paths without http/https prefix", async () => {
      await proxy.start();
      const response = await fetch(
        `http://127.0.0.1:${proxy.port}/ftp://example.com`,
      );
      expect(response.status).toBe(400);
    });
  });
});
