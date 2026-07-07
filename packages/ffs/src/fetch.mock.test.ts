import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ffsFetch, clearAgentCache } from "./fetch";
import { validateUrl, validatedLookup } from "./url";
import { Agent } from "undici";

// Mock undici
vi.mock("undici", async () => {
  const actual = await vi.importActual<typeof import("undici")>("undici");
  return {
    ...actual,
    fetch: vi.fn(),
    Agent: vi.fn(() => ({ close: vi.fn().mockResolvedValue(undefined) })),
  };
});

// Mock URL validation (tested separately in url.test.ts)
vi.mock("./url", () => ({
  validateUrl: vi.fn(),
  validatedLookup: vi.fn(),
  SsrfError: class SsrfError extends Error {},
}));

describe("ffsFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAgentCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("User-Agent header", () => {
    test("sets default User-Agent header", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com");

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "FFS (+https://effing.dev/ffs)",
          }),
        }),
      );
    });

    test("merges custom headers with default User-Agent", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: {
            "User-Agent": "FFS (+https://effing.dev/ffs)",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    test("allows overriding User-Agent via headers", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com", {
        headers: {
          "User-Agent": "CustomBot/1.0",
        },
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: {
            "User-Agent": "CustomBot/1.0",
          },
        }),
      );
    });
  });

  describe("Agent configuration", () => {
    test("creates Agent with default timeout settings", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com");

      expect(mockAgent).toHaveBeenCalledWith({
        headersTimeout: 300000, // 5 minutes
        bodyTimeout: 300000, // 5 minutes
      });
    });

    test("creates Agent with custom headersTimeout", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com", {
        headersTimeout: 600000, // 10 minutes
      });

      expect(mockAgent).toHaveBeenCalledWith({
        headersTimeout: 600000,
        bodyTimeout: 300000, // default
      });
    });

    test("creates Agent with custom bodyTimeout", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com", {
        bodyTimeout: 0, // infinite
      });

      expect(mockAgent).toHaveBeenCalledWith({
        headersTimeout: 300000, // default
        bodyTimeout: 0,
      });
    });

    test("creates Agent with both custom timeouts", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com", {
        headersTimeout: 600000,
        bodyTimeout: 0,
      });

      expect(mockAgent).toHaveBeenCalledWith({
        headersTimeout: 600000,
        bodyTimeout: 0,
      });
    });

    test("rejects redirects for SSRF protection", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/" },
        }),
      );

      await expect(ffsFetch("https://example.com")).rejects.toThrow(
        "https://example.com returned a 302 redirect to http://169.254.169.254/, which is not allowed",
      );
    });

    test("rejects redirects without location header", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response(null, { status: 301 }));

      await expect(ffsFetch("https://example.com")).rejects.toThrow(
        "https://example.com returned a 301 redirect, which is not allowed",
      );
    });

    test("reuses one Agent across calls with the same timeouts", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValue(new Response("ok"));

      await ffsFetch("https://example.com/one");
      await ffsFetch("https://example.com/two");

      expect(mockAgent).toHaveBeenCalledTimes(1);
      const [first, second] = mockedFetch.mock.calls;
      expect(first[1]?.dispatcher).toBe(second[1]?.dispatcher);
      expect(first[1]?.dispatcher).toBeDefined();
    });

    test("creates separate Agents for different timeout configs", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValue(new Response("ok"));

      await ffsFetch("https://example.com/one");
      await ffsFetch("https://example.com/two", { bodyTimeout: 0 });

      expect(mockAgent).toHaveBeenCalledTimes(2);
      const [first, second] = mockedFetch.mock.calls;
      expect(first[1]?.dispatcher).not.toBe(second[1]?.dispatcher);
    });

    test("closes cached Agents when the cache is cleared", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValue(new Response("ok"));

      await ffsFetch("https://example.com/one");
      await ffsFetch("https://example.com/two", { bodyTimeout: 0 });

      const agents = mockedFetch.mock.calls.map(
        (call) => call[1]?.dispatcher as unknown as { close: () => void },
      );
      clearAgentCache();

      expect(agents).toHaveLength(2);
      for (const agent of agents) {
        expect(agent.close).toHaveBeenCalledTimes(1);
      }
    });

    test("passes Agent as dispatcher to fetch", async () => {
      const mockAgentInstance = {
        mock: "agent",
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockAgent = vi.mocked(Agent);
      mockAgent.mockReturnValueOnce(mockAgentInstance as unknown as Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com");

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          dispatcher: mockAgentInstance,
        }),
      );
    });
  });

  describe("SSRF protection", () => {
    test("validates the URL and pins DNS when private networks are disallowed", async () => {
      vi.stubEnv("FFS_ALLOW_PRIVATE_NETWORKS", "false");
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com");

      expect(validateUrl).toHaveBeenCalledWith("https://example.com");
      expect(mockAgent).toHaveBeenCalledWith({
        headersTimeout: 300000,
        bodyTimeout: 300000,
        connect: { lookup: validatedLookup },
      });
    });

    test("skips validation and DNS pinning when private networks are allowed", async () => {
      vi.stubEnv("FFS_ALLOW_PRIVATE_NETWORKS", "true");
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com");

      expect(validateUrl).not.toHaveBeenCalled();
      expect(mockAgent).toHaveBeenCalledWith({
        headersTimeout: 300000,
        bodyTimeout: 300000,
      });
    });

    test("uses separate Agents for pinned and unpinned fetches with the same timeouts", async () => {
      const mockAgent = vi.mocked(Agent);
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValue(new Response("ok"));

      vi.stubEnv("FFS_ALLOW_PRIVATE_NETWORKS", "true");
      await ffsFetch("https://example.com/one");
      vi.stubEnv("FFS_ALLOW_PRIVATE_NETWORKS", "false");
      await ffsFetch("https://example.com/two");

      expect(mockAgent).toHaveBeenCalledTimes(2);
      const [first, second] = mockedFetch.mock.calls;
      expect(first[1]?.dispatcher).not.toBe(second[1]?.dispatcher);
    });

    test("does not fetch when URL validation fails", async () => {
      vi.stubEnv("FFS_ALLOW_PRIVATE_NETWORKS", "false");
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      vi.mocked(validateUrl).mockRejectedValueOnce(
        new Error("URL blocked by SSRF protection: blocked IP address"),
      );

      await expect(ffsFetch("http://169.254.169.254/")).rejects.toThrow(
        "URL blocked by SSRF protection",
      );
      expect(mockedFetch).not.toHaveBeenCalled();
    });
  });

  describe("HTTP methods", () => {
    test("supports GET requests (default)", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com");

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.not.objectContaining({
          method: expect.any(String),
        }),
      );
    });

    test("supports POST requests", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      await ffsFetch("https://example.com", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    test("supports PUT requests with body and headers", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockResolvedValueOnce(new Response("ok"));

      const buffer = Buffer.from("video data");
      await ffsFetch("https://s3.example.com/video.mp4", {
        method: "PUT",
        body: buffer,
        bodyTimeout: 0, // infinite for large uploads
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": buffer.length.toString(),
        },
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        "https://s3.example.com/video.mp4",
        expect.objectContaining({
          method: "PUT",
          body: buffer,
          headers: expect.objectContaining({
            "User-Agent": "FFS (+https://effing.dev/ffs)",
            "Content-Type": "video/mp4",
            "Content-Length": buffer.length.toString(),
          }),
        }),
      );
    });
  });

  describe("Response handling", () => {
    test("returns Response object", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      const mockResponse = new Response("ok");
      mockedFetch.mockResolvedValueOnce(mockResponse);

      const response = await ffsFetch("https://example.com");

      expect(response).toBe(mockResponse);
    });

    test("propagates fetch errors", async () => {
      const { fetch: mockFetch } = await import("undici");
      const mockedFetch = vi.mocked(mockFetch);
      mockedFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(ffsFetch("https://example.com")).rejects.toThrow(
        "Network error",
      );
    });
  });
});
