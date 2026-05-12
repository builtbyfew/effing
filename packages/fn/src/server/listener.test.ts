import type { IncomingMessage, RequestListener } from "node:http";
import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { z } from "zod";
import type { FnKind, FnModule, FnModuleLoader } from "../types";
import { createFnHttpListener } from "./listener";
import { signFnSegment } from "./segments";

const SECRET = "test-secret";

// Tight Uint8Arrays (not pool-backed Buffers). imageResponse reads
// `.buffer` directly, so a pool-backed Buffer would leak unrelated bytes.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_BYTES = Buffer.from(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));

type ImageModule = FnModule<"image">;
type AnnieModule = FnModule<"annie">;
type EffieModule = FnModule<"effie">;

function makeImageModule(
  schema: z.ZodSchema<unknown>,
  runner: (args: {
    props: unknown;
    bounds: { width: number; height: number };
  }) => Promise<Uint8Array>,
): ImageModule {
  return {
    propsSchema: schema,
    previewProps: {},
    runner,
  } as unknown as ImageModule;
}

function makeAnnieModule(
  schema: z.ZodSchema<unknown>,
  runner: (args: {
    props: unknown;
    bounds: { width: number; height: number };
  }) => AsyncIterable<Buffer>,
): AnnieModule {
  return { propsSchema: schema, previewProps: {}, runner } as AnnieModule;
}

function makeEffieModule(
  schema: z.ZodSchema<unknown>,
  runner: (args: {
    props: unknown;
    bounds: { width: number; height: number };
  }) => Promise<unknown>,
): EffieModule {
  return { propsSchema: schema, previewProps: {}, runner } as EffieModule;
}

function makeLoader(
  modules: Partial<Record<FnKind, Record<string, FnModule<FnKind>>>>,
): FnModuleLoader {
  const m = {
    image: modules.image ?? {},
    annie: modules.annie ?? {},
    effie: modules.effie ?? {},
  };
  return {
    async loadModule<K extends FnKind>(
      kind: K,
      id: string,
    ): Promise<FnModule<K>> {
      const mod = m[kind]?.[id];
      if (!mod) throw new Error(`no ${kind} for id ${id}`);
      return mod as FnModule<K>;
    },
    listModules(kind) {
      return Object.keys(m[kind] ?? {});
    },
    hasModule(kind, id) {
      return Boolean(m[kind]?.[id]);
    },
  };
}

type CallResult = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

// Invoke the listener with synthetic req/res. Avoids binding a real TCP
// socket, which keeps the test runnable under sandboxes that deny listen().
async function callListener(
  listener: RequestListener,
  opts: { method?: string; url: string },
): Promise<CallResult> {
  const req = {
    method: opts.method ?? "GET",
    url: opts.url,
    headers: {},
  } as IncomingMessage;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const headers: Record<string, string> = {};

    class FakeRes extends Writable {
      statusCode = 200;
      headersSent = false;
      writableEnded = false;

      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name.toLowerCase()] = String(value);
      }
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      }
      writeHead(code: number, h?: Record<string, string>) {
        this.statusCode = code;
        if (h)
          for (const [k, v] of Object.entries(h))
            headers[k.toLowerCase()] = String(v);
        this.headersSent = true;
        return this;
      }
      override end(chunk?: unknown, ...rest: unknown[]): this {
        if (chunk != null) chunks.push(Buffer.from(chunk as Uint8Array));
        this.headersSent = true;
        this.writableEnded = true;
        super.end(...(rest as []));
        return this;
      }
      override _write(
        chunk: Buffer | Uint8Array | string,
        _enc: BufferEncoding,
        cb: (err?: Error) => void,
      ) {
        chunks.push(Buffer.from(chunk));
        cb();
      }
    }

    const res = new FakeRes();
    res.on("finish", () =>
      resolve({ status: res.statusCode, headers, body: Buffer.concat(chunks) }),
    );
    res.on("error", reject);

    try {
      listener(req, res as unknown as Parameters<RequestListener>[1]);
    } catch (e) {
      reject(e as Error);
    }
  });
}

function makeListener(loader: FnModuleLoader): RequestListener {
  return createFnHttpListener({ moduleLoader: loader, secretKey: SECRET });
}

describe("createFnHttpListener", () => {
  let pending: Array<Promise<unknown>> = [];

  beforeEach(() => {
    pending = [];
  });

  afterEach(async () => {
    await Promise.all(pending);
  });

  test("serves a signed image segment as PNG", async () => {
    const loader = makeLoader({
      image: {
        "my-image": makeImageModule(
          z.object({ text: z.string() }),
          async ({ props }) => {
            expect((props as { text: string }).text).toBe("hi");
            return PNG_BYTES;
          },
        ),
      },
    });
    const segment = await signFnSegment(
      {
        id: "my-image",
        props: { text: "hi" },
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await callListener(makeListener(loader), {
      url: `/image/${segment}`,
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(Array.from(new Uint8Array(res.body))).toEqual(Array.from(PNG_BYTES));
  });

  test("serves an effie segment as JSON", async () => {
    const effieValue = {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.jpg",
      background: { type: "color", color: "black" },
      segments: [],
    };
    const loader = makeLoader({
      effie: {
        "my-effie": makeEffieModule(
          z.object({}).passthrough(),
          async () => effieValue,
        ),
      },
    });
    const segment = await signFnSegment(
      {
        id: "my-effie",
        props: {},
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await callListener(makeListener(loader), {
      url: `/effie/${segment}`,
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.toString("utf8"))).toEqual(effieValue);
  });

  test("streams annie frames as a TAR", async () => {
    async function* frames() {
      yield JPEG_BYTES;
      yield JPEG_BYTES;
    }
    const loader = makeLoader({
      annie: {
        "my-annie": makeAnnieModule(z.object({}).passthrough(), () => frames()),
      },
    });
    const segment = await signFnSegment(
      {
        id: "my-annie",
        props: {},
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await callListener(makeListener(loader), {
      url: `/annie/${segment}`,
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/x-tar");
    // TAR consists of 512-byte blocks; two frames + headers should be a few KB.
    expect(res.body.byteLength).toBeGreaterThan(512);
  });

  test("returns 400 for an unsigned / tampered segment", async () => {
    const loader = makeLoader({
      image: {
        x: makeImageModule(z.object({}).passthrough(), async () => PNG_BYTES),
      },
    });
    const res = await callListener(makeListener(loader), {
      url: "/image/garbage-segment",
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown id", async () => {
    const loader = makeLoader({ image: {} });
    const segment = await signFnSegment(
      {
        id: "ghost",
        props: {},
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await callListener(makeListener(loader), {
      url: `/image/${segment}`,
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 when props fail the schema", async () => {
    const loader = makeLoader({
      image: {
        strict: makeImageModule(
          z.object({ text: z.string() }),
          async () => PNG_BYTES,
        ),
      },
    });
    const segment = await signFnSegment(
      {
        id: "strict",
        props: { text: 123 },
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await callListener(makeListener(loader), {
      url: `/image/${segment}`,
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 on unknown route shape", async () => {
    const loader = makeLoader({});
    const res = await callListener(makeListener(loader), {
      url: "/nope/whatever",
    });
    expect(res.status).toBe(404);
  });

  test("returns 405 for non-GET", async () => {
    const loader = makeLoader({});
    const res = await callListener(makeListener(loader), {
      method: "POST",
      url: "/image/x",
    });
    expect(res.status).toBe(405);
  });
});
