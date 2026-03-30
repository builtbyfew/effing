import { lookup } from "dns/promises";

/**
 * Error thrown when a URL fails SSRF validation.
 */
export class SsrfError extends Error {
  constructor(
    public readonly url: string,
    reason: string,
  ) {
    super(`URL blocked by SSRF protection: ${reason}`);
    this.name = "SsrfError";
  }
}

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const V4_MAPPED_DOTTED_RE = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;
const V4_MAPPED_HEX_RE = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;

function isBlockedIpv4(first: number, second: number): boolean {
  if (first === 127) return true;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  if (first === 0) return true;
  return false;
}

/**
 * Check whether an IPv4 or IPv6 address is in a blocked range.
 *
 * Blocked ranges:
 * - Loopback: 127.0.0.0/8, ::1
 * - Private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Link-local: 169.254.0.0/16, fe80::/10
 * - Unique local: fc00::/7
 * - Unspecified: 0.0.0.0, ::
 */
export function isBlockedIp(ip: string): boolean {
  // IPv4 dotted-decimal
  if (IPV4_RE.test(ip)) {
    const parts = ip.split(".").map(Number);
    return isBlockedIpv4(parts[0]!, parts[1]!);
  }

  // IPv6
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized === "::") return true;
  // fe80::/10 — first 10 bits are 1111111010, covering fe80-febf
  const fe = normalized.slice(0, 4);
  if (fe >= "fe80" && fe <= "febf") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // IPv4-mapped IPv6 — dotted form (::ffff:127.0.0.1)
  const dottedMatch = V4_MAPPED_DOTTED_RE.exec(normalized);
  if (dottedMatch) return isBlockedIp(dottedMatch[1]!);

  // IPv4-mapped IPv6 — hex form (::ffff:7f00:1)
  const hexMatch = V4_MAPPED_HEX_RE.exec(normalized);
  if (hexMatch) {
    const high = parseInt(hexMatch[1]!, 16);
    const first = (high >> 8) & 0xff;
    const second = high & 0xff;
    return isBlockedIpv4(first, second);
  }

  return false;
}

/** TTL-based DNS validation cache to avoid repeated lookups for the same host. */
const DNS_CACHE_TTL_MS = 30_000;
const DNS_CACHE_MAX_SIZE = 1024;
const dnsCache = new Map<string, { expiresAt: number; blocked: boolean }>();

/**
 * Validate that a URL does not target internal/private network addresses.
 * Resolves the hostname to an IP before checking.
 *
 * @throws {SsrfError} if the URL targets a blocked address
 */
export async function validateUrl(url: string): Promise<void> {
  if (url.startsWith("data:")) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError(url, "invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfError(url, `blocked scheme: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // Check if hostname is already an IP literal
  if (isBlockedIp(hostname)) {
    throw new SsrfError(url, "blocked IP address");
  }

  // Check DNS cache (delete+set to maintain LRU order)
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    dnsCache.delete(hostname);
    dnsCache.set(hostname, cached);
    if (cached.blocked) {
      throw new SsrfError(url, "hostname resolves to blocked IP address");
    }
    return;
  }

  // Resolve all addresses and check each one
  try {
    const results = await lookup(hostname, { all: true });
    const blocked = results.some((r) => isBlockedIp(r.address));
    // Evict oldest entry when cache is full (Map preserves insertion order)
    if (dnsCache.size >= DNS_CACHE_MAX_SIZE) {
      const oldest = dnsCache.keys().next().value!;
      dnsCache.delete(oldest);
    }
    dnsCache.set(hostname, {
      expiresAt: Date.now() + DNS_CACHE_TTL_MS,
      blocked,
    });
    if (blocked) {
      throw new SsrfError(url, "hostname resolves to blocked IP address");
    }
  } catch (error) {
    if (error instanceof SsrfError) throw error;
    throw new SsrfError(
      url,
      `DNS lookup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
