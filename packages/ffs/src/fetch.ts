import { fetch, Agent, type Response, type BodyInit } from "undici";

/**
 * Options for ffsFetch function
 */
export type FfsFetchOptions = {
  /** HTTP method */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  /** Request body */
  body?: BodyInit;
  /** Headers to send (merged with default User-Agent) */
  headers?: Record<string, string>;
  /** Timeout for receiving response headers in ms. @default 300000 (5 min) */
  headersTimeout?: number;
  /** Timeout between body data chunks in ms. 0 = no timeout. @default 300000 (5 min) */
  bodyTimeout?: number;
};

/**
 * Fetch with default User-Agent and configurable timeouts.
 *
 * @example
 * // Simple GET
 * const response = await ffsFetch("https://example.com/data.json");
 *
 * @example
 * // Large file with infinite body timeout
 * const response = await ffsFetch("https://example.com/video.mp4", {
 *   bodyTimeout: 0,
 * });
 *
 * @example
 * // PUT upload
 * const response = await ffsFetch("https://s3.example.com/video.mp4", {
 *   method: "PUT",
 *   body: videoBuffer,
 *   bodyTimeout: 0,
 *   headers: { "Content-Type": "video/mp4" },
 * });
 */
export async function ffsFetch(
  url: string,
  options?: FfsFetchOptions,
): Promise<Response> {
  const {
    method,
    body,
    headers,
    headersTimeout = 300000, // 5 minutes
    bodyTimeout = 300000, // 5 minutes
  } = options ?? {};

  const agent = new Agent({ headersTimeout, bodyTimeout });

  return fetch(url, {
    method,
    body,
    headers: { "User-Agent": "FFS (+https://effing.dev/ffs)", ...headers },
    dispatcher: agent,
  });
}
