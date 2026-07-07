import type { EffieData, EffieSources } from "@effing/effie";
import { annieStream } from "@effing/annie";
import type { AnnieStreamOptions } from "@effing/annie";

export type ImageResponseOptions = {
  headers?: HeadersInit;
  cacheControl?: string;
};

function detectImageContentType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  throw new Error("Unsupported image format: expected PNG or JPEG");
}

export function imageResponse(
  bytes: Uint8Array,
  options: ImageResponseOptions = {},
): Response {
  const { headers: extraHeaders, cacheControl = "public, max-age=3600" } =
    options;

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", detectImageContentType(bytes));
  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }

  if (!(bytes.buffer instanceof ArrayBuffer)) {
    throw new TypeError("SharedArrayBuffer is not supported");
  }

  // Serve only the window `bytes` describes, not its whole backing buffer:
  // `bytes` may be a view (offset/length) into a larger pooled buffer, and
  // serving the backing buffer would corrupt the body and leak adjacent bytes.
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );

  return new Response(body, { status: 200, headers });
}

export type AnnieResponseOptions = AnnieStreamOptions & {
  headers?: HeadersInit;
  cacheControl?: string;
  filename?: string;
};

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

export type EffieResponseOptions = {
  headers?: HeadersInit;
  cacheControl?: string;
};

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
