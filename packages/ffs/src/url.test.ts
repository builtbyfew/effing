import { describe, expect, it, vi, beforeEach } from "vitest";
import { lookup } from "dns/promises";
import type { LookupAddress, LookupOptions } from "dns";
import { isBlockedIp, validateUrl, validatedLookup, SsrfError } from "./url";

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

  it("allows public URLs and returns the validated addresses", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    await expect(
      validateUrl("https://cdn.example.com/video.mp4"),
    ).resolves.toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("allows data URLs and returns null", async () => {
    await expect(
      validateUrl("data:text/plain;base64,aGVsbG8="),
    ).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("allows public IP literals without a DNS lookup and returns null", async () => {
    await expect(validateUrl("http://8.8.8.8/video.mp4")).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
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

describe("validatedLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Promisified wrapper around the callback-style net.LookupFunction. */
  function callLookup(
    hostname: string,
    options: LookupOptions,
  ): Promise<{ address: string | LookupAddress[]; family?: number }> {
    return new Promise((resolve, reject) => {
      validatedLookup(hostname, options, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address, family });
      });
    });
  }

  it("returns all validated addresses when options.all is set", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2001:db8::1", family: 6 },
    ] as never);

    await expect(callLookup("all.example.com", { all: true })).resolves.toEqual(
      {
        address: [
          { address: "93.184.216.34", family: 4 },
          { address: "2001:db8::1", family: 6 },
        ],
      },
    );
  });

  it("returns a single address when options.all is not set", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    await expect(callLookup("single.example.com", {})).resolves.toEqual({
      address: "93.184.216.34",
      family: 4,
    });
  });

  it("filters by the requested address family", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2001:db8::1", family: 6 },
    ] as never);

    await expect(
      callLookup("family.example.com", { family: 6, all: true }),
    ).resolves.toEqual({ address: [{ address: "2001:db8::1", family: 6 }] });
  });

  it("fails with ENOTFOUND when no address matches the requested family", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);

    await expect(
      callLookup("v4only.example.com", { family: 6 }),
    ).rejects.toMatchObject({ code: "ENOTFOUND" });
  });

  it("rejects a hostname that resolves to a blocked IP at connect time", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "169.254.169.254", family: 4 },
    ] as never);

    await expect(
      callLookup("metadata.example.com", { all: true }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects blocked IP literals", async () => {
    await expect(callLookup("127.0.0.1", { all: true })).rejects.toBeInstanceOf(
      SsrfError,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it("connects to the addresses validated by validateUrl even if DNS changes (rebinding)", async () => {
    // Public at validation time...
    vi.mocked(lookup).mockResolvedValueOnce([
      { address: "203.0.113.7", family: 4 },
    ] as never);
    await validateUrl("https://rebind.example.com/video.mp4");

    // ...internal at connect time.
    vi.mocked(lookup).mockResolvedValue([
      { address: "10.0.0.1", family: 4 },
    ] as never);

    await expect(
      callLookup("rebind.example.com", { all: true }),
    ).resolves.toEqual({
      address: [{ address: "203.0.113.7", family: 4 }],
    });
  });
});
