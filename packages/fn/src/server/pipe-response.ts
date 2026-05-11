import type { ServerResponse } from "node:http";
import { Readable } from "node:stream";

/**
 * Send a Web `Response` (as returned by `imageResponse`/`annieResponse`/
 * `effieResponse`) over a Node `ServerResponse`. Headers and status are
 * copied; the body is streamed if present.
 */
export async function pipeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = response.body;
  if (!body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(
    body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  nodeStream.pipe(res);

  await new Promise<void>((resolve, reject) => {
    nodeStream.on("end", () => resolve());
    nodeStream.on("error", reject);
    res.on("close", () => resolve());
  });
}
