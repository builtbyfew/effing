import type { Image } from "@napi-rs/canvas";
import { loadImage as nativeLoadImage } from "@napi-rs/canvas";

/** Source types accepted by {@link loadImage}, mirroring @napi-rs/canvas. */
export type LoadImageSource = Parameters<typeof nativeLoadImage>[0];

/** Options for {@link loadImage}. */
export interface LoadImageOptions {
  /**
   * User-Agent header sent on remote (http/https) fetches. Matches the
   * `userAgent` option of `renderReactElement`, so `loadImage(url)` and an
   * `<img src={url}>` behave identically. An empty string is sent as an
   * explicit empty header; values with CR/LF cause fetch to throw `TypeError`.
   * Ignored for non-remote sources (paths, Buffers, data URIs).
   */
  userAgent?: string;
}

/**
 * Load an image from a path, Buffer, data URI, or remote URL.
 *
 * Remote http/https URLs are fetched via global fetch() and passed to the
 * native loader as bytes — the same path `<img>` sources take in
 * `renderReactElement`. This keeps `loadImage(url)` and `<img src={url}>`
 * consistent: both honor a global dispatcher / proxy (undici's
 * setGlobalDispatcher) and the `userAgent` option. @napi-rs/canvas's own URL
 * loader uses Node's raw http modules, which bypass any dispatcher, so it is
 * only used for non-remote sources here.
 *
 * Note: @napi-rs/canvas's `maxRedirects` / `requestOptions` load options are
 * intentionally not exposed — they only configure its built-in URL loader,
 * which this wrapper bypasses. Control remote fetches via fetch/undici instead.
 */
export function loadImage(
  source: LoadImageSource,
  options?: LoadImageOptions,
): Promise<Image> {
  const remoteUrl =
    typeof source === "string" && isRemoteUrl(source)
      ? source
      : source instanceof URL && isRemoteUrl(source.href)
        ? source.href
        : undefined;
  if (remoteUrl !== undefined) {
    return loadRemoteImage(remoteUrl, options?.userAgent);
  }
  return nativeLoadImage(source);
}

/**
 * Per-render cache of image load promises, keyed by source string.
 * Shared between layout and draw phases to avoid duplicate loads.
 */
export type ImageCache = Map<string, Promise<Image>>;

/**
 * Load an image via {@link loadImage}, deduplicating by source string through
 * the cache. Buffer sources are never cached (no stable key). `userAgent`, when
 * set, is forwarded to remote (http/https) fetches. The cache key is the URL
 * alone — the userAgent of the first call for a given URL is the one that hits
 * the wire; a later call with a different userAgent reuses the cached promise.
 *
 * Failed loads are evicted, so only successful loads stay cached: callers
 * sharing one cache across many renders (`options.imageCache`) retry a
 * transiently-failed source on the next call instead of replaying the
 * rejection forever.
 */
export function cachedLoadImage(
  cache: ImageCache,
  src: string | Buffer,
  userAgent?: string,
): Promise<Image> {
  if (Buffer.isBuffer(src)) return loadImage(src);
  let entry = cache.get(src);
  if (!entry) {
    const created = loadImage(
      src,
      userAgent === undefined ? undefined : { userAgent },
    );
    created.catch(() => {
      if (cache.get(src) === created) cache.delete(src);
    });
    cache.set(src, created);
    entry = created;
  }
  return entry;
}

/**
 * True for http/https URLs, which are loaded via fetch() rather than the
 * native loader. Scheme match is case-insensitive (RFC 3986 §3.1).
 */
export function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/**
 * Fetch a remote image via global fetch() and decode the bytes with the native
 * loader. Routing through fetch (rather than @napi-rs/canvas's raw-http URL
 * loader) lets a global dispatcher / proxy and the `userAgent` apply.
 */
export async function loadRemoteImage(
  url: string,
  userAgent?: string,
): Promise<Image> {
  const init: RequestInit | undefined =
    userAgent !== undefined
      ? { headers: { "User-Agent": userAgent } }
      : undefined;
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return nativeLoadImage(buffer);
}
