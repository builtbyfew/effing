/**
 * Operator-configured URL rewrites for outbound fetches.
 *
 * A rewrite sends requests for one origin to another, e.g. a public hostname
 * to the internal address of the same service, so that FFS running next to
 * that service fetches from it directly instead of via the public internet
 * (and its CDN). Only the request's destination changes: callers keep using
 * the original URL for cache keys, events and error messages.
 *
 * Rules are origin-to-origin on purpose: the path, query and fragment go
 * through unchanged, so the target sees exactly the request the public origin
 * would have. Path-scoped rules would need a boundary that dot segments (which
 * Node's URL parser doesn't always resolve) and encoded slashes could cross.
 */

/** Requests whose URL starts with `from` go to `to` + the rest of the URL. */
export type UrlRewrite = { readonly from: string; readonly to: string };

/** Thrown when `FFS_URL_REWRITES` is malformed. */
export class UrlRewriteConfigError extends Error {
  constructor(message: string) {
    super(`Invalid FFS_URL_REWRITES: ${message}`);
    this.name = "UrlRewriteConfigError";
  }
}

/**
 * Normalizes one side of a rule to an http(s) origin followed by "/", e.g.
 * "https://a.example/". Anything more than an origin (a path, credentials, a
 * query or fragment, even an empty "?" or "#") is rejected.
 */
function normalizeOrigin(value: unknown, side: "from" | "to"): string {
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
  const prefix = `${url.origin}/`;
  if (url.href !== prefix) {
    throw new UrlRewriteConfigError(
      `${side} ${value} must be a bare origin like ${prefix} (no path, credentials, query or fragment)`,
    );
  }
  return prefix;
}

/**
 * Parses rewrites from a JSON object mapping origins to their replacements,
 * e.g. `{"https://fn.example.com/": "https://fn-internal.example/"}`.
 */
export function parseUrlRewrites(raw: string): readonly UrlRewrite[] {
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
  const rewrites: UrlRewrite[] = [];
  const seen = new Set<string>();
  for (const [rawFrom, rawTo] of Object.entries(parsed)) {
    const from = normalizeOrigin(rawFrom, "from");
    if (seen.has(from)) {
      throw new UrlRewriteConfigError(`${from} is configured more than once`);
    }
    seen.add(from);
    rewrites.push(Object.freeze({ from, to: normalizeOrigin(rawTo, "to") }));
  }
  return Object.freeze(rewrites);
}

let cachedRaw: string | undefined;
let cachedRewrites: readonly UrlRewrite[] = [];

/**
 * The rewrites configured in `FFS_URL_REWRITES` (none when unset). Re-parsed
 * only when the variable changes; throws UrlRewriteConfigError when it's
 * malformed.
 */
export function urlRewrites(): readonly UrlRewrite[] {
  const raw = process.env.FFS_URL_REWRITES?.trim() || undefined;
  if (raw !== cachedRaw) {
    // Parse before caching, so a malformed value keeps throwing.
    cachedRewrites = raw === undefined ? [] : parseUrlRewrites(raw);
    cachedRaw = raw;
  }
  return cachedRewrites;
}

/**
 * The URL to actually request for `url`: rewritten by the rule for its
 * origin, or `url` itself when there's none. URLs with credentials never
 * match (their normalized form doesn't start with the bare origin).
 */
export function rewriteUrl(
  url: string,
  rewrites: readonly UrlRewrite[] = urlRewrites(),
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
