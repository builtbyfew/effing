import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";
import type { FnKind, FnModuleLoader } from "../types";
import { imageResponse, annieResponse, effieResponse } from "../responses";
import { verifyFnSegment } from "./segments";
import { pipeWebResponse } from "./pipe-response";

export type CreateFnHttpListenerOptions = {
  moduleLoader: FnModuleLoader;
  secretKey: string;
  /**
   * Optional Cache-Control header value for successful responses. Defaults to
   * `undefined` (the underlying response helpers apply their own default).
   */
  cacheControl?: string;
};

const KIND_PATTERNS: { kind: FnKind; pattern: RegExp }[] = [
  { kind: "image", pattern: /^\/image\/([^/?#]+)$/ },
  { kind: "annie", pattern: /^\/annie\/([^/?#]+)$/ },
  { kind: "effie", pattern: /^\/effie\/([^/?#]+)$/ },
];

function matchRoute(
  url: string | undefined,
): { kind: FnKind; segment: string } | null {
  if (!url) return null;
  const path = url.split("?")[0];
  for (const { kind, pattern } of KIND_PATTERNS) {
    const m = pattern.exec(path);
    if (m) return { kind, segment: decodeURIComponent(m[1]) };
  }
  return null;
}

function sendJsonError(
  res: ServerResponse,
  status: number,
  error: string,
): void {
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error }));
}

export function createFnHttpListener(
  options: CreateFnHttpListenerOptions,
): RequestListener {
  const { moduleLoader, secretKey, cacheControl } = options;

  return (req: IncomingMessage, res: ServerResponse) => {
    handleRequest(req, res, { moduleLoader, secretKey, cacheControl }).catch(
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);

        console.error("[fn-server] unhandled error:", message);
        sendJsonError(res, 500, "Internal error");
      },
    );
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<
    Pick<CreateFnHttpListenerOptions, "moduleLoader" | "secretKey">
  > & {
    cacheControl?: string;
  },
): Promise<void> {
  const { moduleLoader, secretKey, cacheControl } = options;

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end();
    return;
  }

  const matched = matchRoute(req.url);
  if (!matched) {
    sendJsonError(res, 404, "Not found");
    return;
  }

  let payload;
  try {
    payload = await verifyFnSegment(matched.segment, secretKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid segment";
    sendJsonError(res, 400, message);
    return;
  }

  if (!moduleLoader.hasModule(matched.kind, payload.id)) {
    sendJsonError(res, 404, `No ${matched.kind} found for id '${payload.id}'`);
    return;
  }

  const mod = await moduleLoader.loadModule(matched.kind, payload.id);
  let parsedProps: unknown = payload.props ?? {};
  if (mod.propsSchema) {
    try {
      parsedProps = mod.propsSchema.parse(parsedProps);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid props";
      sendJsonError(res, 400, message);
      return;
    }
  }

  const runnerArgs = { props: parsedProps, bounds: payload.bounds };

  if (matched.kind === "image") {
    const bytes = await (
      mod as { runner: (a: typeof runnerArgs) => Promise<Buffer> }
    ).runner(runnerArgs);
    await pipeWebResponse(res, imageResponse(bytes, { cacheControl }));
    return;
  }

  if (matched.kind === "annie") {
    const frames = (
      mod as { runner: (a: typeof runnerArgs) => AsyncIterable<Buffer> }
    ).runner(runnerArgs);
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    await pipeWebResponse(
      res,
      annieResponse(frames, {
        signal: abort.signal,
        filename: payload.id,
        cacheControl,
      }),
    );
    return;
  }

  const data = await (
    mod as { runner: (a: typeof runnerArgs) => Promise<unknown> }
  ).runner(runnerArgs);
  await pipeWebResponse(
    res,
    effieResponse(data as Parameters<typeof effieResponse>[0], {
      cacheControl,
    }),
  );
}
