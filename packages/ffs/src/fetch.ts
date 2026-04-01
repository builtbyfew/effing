import { fetch, Agent, type Response, type BodyInit } from "undici";
import { validateUrl } from "./url";

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

  // SSRF protection is on in production, off in development by default.
  // Override with FFS_ALLOW_PRIVATE_NETWORKS=true|false.
  const envAllow = process.env.FFS_ALLOW_PRIVATE_NETWORKS;
  const allowPrivate =
    envAllow !== undefined
      ? envAllow === "true" || envAllow === "1"
      : process.env.NODE_ENV !== "production";

  if (!allowPrivate) {
    await validateUrl(url);
  }

  const agent = new Agent({ headersTimeout, bodyTimeout });

  const response = await fetch(url, {
    method,
    body,
    redirect: "manual",
    headers: { "User-Agent": "FFS (+https://effing.dev/ffs)", ...headers },
    dispatcher: agent,
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    throw new Error(
      `${url} returned a ${response.status} redirect${location ? ` to ${location}` : ""}, which is not allowed`,
    );
  }

  return response;
}
