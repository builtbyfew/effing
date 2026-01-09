import type { EffieData, EffieSources } from "./types";

/**
 * Options for effie Response generation
 */
export type EffieResponseOptions = {
  /** Additional headers to include in the response */
  headers?: HeadersInit;
  /** Cache-Control header value (default: "public, max-age=3600") */
  cacheControl?: string;
};

/**
 * Create an HTTP Response containing effie JSON data
 *
 * This is the most convenient way to serve an effie composition from a web server.
 * It handles JSON serialization, content-type, and caching headers automatically.
 *
 * @param data The effie data to serialize
 * @param options Configuration options
 * @returns Response with JSON body
 *
 * @example
 * ```ts
 * // In a route handler:
 * export async function loader({ params }: LoaderFunctionArgs) {
 *   const effie = await renderEffie(effieId, props, { width, height });
 *   return effieResponse(effie);
 * }
 * ```
 */
export function effieResponse<S extends EffieSources>(
  data: EffieData<S>,
  options: EffieResponseOptions = {},
): Response {
  const { headers: extraHeaders, cacheControl = "public, max-age=3600" } =
    options;

  const headers = new Headers(extraHeaders);
  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }

  return Response.json(data, { status: 200, headers });
}
