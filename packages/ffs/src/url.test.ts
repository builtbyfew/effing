import { describe, expect, it, vi, beforeEach } from "vitest";
import { lookup } from "dns/promises";
import { isBlockedIp, validateUrl, SsrfError } from "./url";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(),
}));

describe("isBlockedIp", () => {
  it.each([
    // IPv4
    ["127.0.0.1", true],
    ["127.255.255.255", true],
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.15.0.1", false],
    ["172.32.0.1", false],
    ["192.168.0.1", true],
    ["192.168.255.255", true],
    ["169.254.169.254", true],
    ["169.254.0.1", true],
    ["0.0.0.0", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["203.0.113.1", false],
    // IPv6
    ["::1", true],
    ["::", true],
    ["fe80::1", true],
    ["fea0::1", true],
    ["febf::1", true],
    ["fec0::1", false],
    ["fc00::1", true],
    ["fd12::1", true],
    ["2001:db8::1", false],
    // IPv4-mapped IPv6 — dotted form
    ["::ffff:127.0.0.1", true],
    ["::ffff:8.8.8.8", false],
    // IPv4-mapped IPv6 — hex form
    ["::ffff:7f00:1", true],
    ["::ffff:a9fe:a9fe", true],
    ["::ffff:808:808", false],
  ])("isBlockedIp(%s) = %s", (ip, expected) => {
    expect(isBlockedIp(ip)).toBe(expected);
  });
});

describe("validateUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid URLs", async () => {
    await expect(validateUrl("not-a-url")).rejects.toThrow(SsrfError);
  });

  it("rejects non-http schemes", async () => {
    await expect(validateUrl("ftp://example.com")).rejects.toThrow(
      "blocked scheme",
    );
    await expect(validateUrl("file:///etc/passwd")).rejects.toThrow(
      "blocked scheme",
    );
  });

  it("rejects loopback IPs", async () => {
    await expect(validateUrl("http://127.0.0.1/secret")).rejects.toThrow(
      SsrfError,
    );
  });

  it("rejects cloud metadata endpoint", async () => {
    await expect(
      validateUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow(SsrfError);
  });

  it("rejects private IPs", async () => {
    await expect(validateUrl("http://10.0.0.1/")).rejects.toThrow(SsrfError);
    await expect(validateUrl("http://192.168.1.1/")).rejects.toThrow(SsrfError);
    await expect(validateUrl("http://172.16.0.1/")).rejects.toThrow(SsrfError);
  });

  it("rejects IPv6 loopback", async () => {
    await expect(validateUrl("http://[::1]/")).rejects.toThrow(SsrfError);
  });

  it("rejects localhost by DNS resolution", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ] as never);
    await expect(validateUrl("http://localhost/")).rejects.toThrow(SsrfError);
  });

  it("allows public URLs", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    await expect(
      validateUrl("https://cdn.example.com/video.mp4"),
    ).resolves.toBeUndefined();
  });

  it("allows data URLs", async () => {
    await expect(
      validateUrl("data:text/plain;base64,aGVsbG8="),
    ).resolves.toBeUndefined();
  });

  it("rejects when any DNS result is a private IP", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ] as never);

    await expect(
      validateUrl("https://evil.com/steal-metadata"),
    ).rejects.toThrow("hostname resolves to blocked IP");
  });
});
