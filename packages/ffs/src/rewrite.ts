/**
 * Operator-configured URL rewrites for outbound fetches.
 *
 * A rewrite sends requests for one URL prefix to another, e.g. a public
 * hostname to the internal address of the same service, so that FFS running
 * next to that service fetches from it directly instead of via the public
 * internet (and its CDN). Only the request's destination changes: callers keep
 * using the original URL for cache keys, events and error messages.
 */

/** Requests whose URL starts with `from` go to `to` + the rest of the URL. */
export type UrlRewrite = { from: string; to: string };

/** Thrown when `FFS_URL_REWRITES` is malformed. */
export class UrlRewriteConfigError extends Error {
  constructor(message: string) {
    super(`Invalid FFS_URL_REWRITES: ${message}`);
    this.name = "UrlRewriteConfigError";
  }
}

/**
 * Normalizes one side of a rule to an absolute http(s) URL prefix that ends
 * in "/", so a rule for https://a.example/ can never match
 * https://a.example.evil.test/ and query strings or fragments can't sneak in.
 */
function normalizePrefix(value: unknown, side: "from" | "to"): string {
  if (typeof value !== "string" || value === "") {
    throw new UrlRewriteConfigError(`${side} must be a non-empty string`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UrlRewriteConfigError(`${side} ${value} is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlRewriteConfigError(`${side} ${value} must be http(s)`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new UrlRewriteConfigError(
      `${side} ${value} must not have credentials, a query or a fragment`,
    );
  }
  if (!url.pathname.endsWith("/")) {
    throw new UrlRewriteConfigError(`${side} ${value} must end with "/"`);
  }
  return url.href;
}

/**
 * Parses rewrites from a JSON object mapping URL prefixes to their
 * replacements, e.g. `{"https://fn.example.com/": "https://fn-internal.example/"}`.
 * The longest matching prefix wins.
 */
export function parseUrlRewrites(raw: string): UrlRewrite[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UrlRewriteConfigError("not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UrlRewriteConfigError(
      'expected a JSON object like {"https://from.example/": "https://to.example/"}',
    );
  }
  return Object.entries(parsed)
    .map(([from, to]) => ({
      from: normalizePrefix(from, "from"),
      to: normalizePrefix(to, "to"),
    }))
    .sort((a, b) => b.from.length - a.from.length);
}

let cachedRaw: string | undefined;
let cachedRewrites: UrlRewrite[] = [];

/**
 * The rewrites configured in `FFS_URL_REWRITES` (none when unset). Re-parsed
 * only when the variable changes; throws UrlRewriteConfigError when it's
 * malformed.
 */
export function urlRewrites(): UrlRewrite[] {
  const raw = process.env.FFS_URL_REWRITES?.trim() || undefined;
  if (raw !== cachedRaw) {
    // Parse before caching, so a malformed value keeps throwing.
    cachedRewrites = raw === undefined ? [] : parseUrlRewrites(raw);
    cachedRaw = raw;
  }
  return cachedRewrites;
}

/**
 * The URL to actually request for `url`: rewritten by the first (longest)
 * matching rule, or `url` itself when none matches.
 */
export function rewriteUrl(
  url: string,
  rewrites: UrlRewrite[] = urlRewrites(),
): string {
  if (rewrites.length === 0) return url;
  let href: string;
  try {
    href = new URL(url).href;
  } catch {
    // Not an absolute URL; leave it for the fetch to reject as before.
    return url;
  }
  for (const { from, to } of rewrites) {
    if (href.startsWith(from)) return to + href.slice(from.length);
  }
  return url;
}
