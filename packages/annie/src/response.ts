import { annieStream } from "./generate";
import type { AnnieStreamOptions } from "./generate";

/**
 * Options for annie Response generation
 */
export type AnnieResponseOptions = AnnieStreamOptions & {
  /** Additional headers to include in the response */
  headers?: HeadersInit;
  /** Cache-Control header value (default: "public, max-age=3600") */
  cacheControl?: string;
  /** Filename for Content-Disposition header (without .tar extension) */
  filename?: string;
};

/**
 * Create an HTTP Response that streams an annie
 *
 * This is the most convenient way to serve an annie animation from a web server.
 * It handles all the streaming, headers, and cleanup automatically.
 *
 * @param frames Async iterator yielding PNG or JPEG frame buffers
 * @param options Configuration options
 * @returns Response streaming the annie
 *
 * @example
 * ```ts
 * // In a route handler:
 * export async function loader({ request, params }: LoaderFunctionArgs) {
 *   const frames = renderAnnieFrames(annieId, props, { width, height });
 *   return annieResponse(frames, {
 *     signal: request.signal,
 *     filename: "my-animation",
 *   });
 * }
 * ```
 */
export function annieResponse(
  frames: AsyncIterable<Buffer>,
  options: AnnieResponseOptions = {},
): Response {
  const {
    headers: extraHeaders,
    cacheControl = "public, max-age=3600",
    filename,
    ...streamOptions
  } = options;

  const stream = annieStream(frames, streamOptions);

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/x-tar");
  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }
  if (filename) {
    headers.set("Content-Disposition", `inline; filename="${filename}.tar"`);
  }

  return new Response(stream, { status: 200, headers });
}
