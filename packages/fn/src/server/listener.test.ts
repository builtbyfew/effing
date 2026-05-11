import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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

async function startServer(loader: FnModuleLoader): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const server = createServer(
    createFnHttpListener({ moduleLoader: loader, secretKey: SECRET }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe("createFnHttpListener", () => {
  let cleanups: Array<() => Promise<void>> = [];

  beforeEach(() => {
    cleanups = [];
  });

  afterEach(async () => {
    for (const cleanup of cleanups) await cleanup();
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
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const segment = await signFnSegment(
      {
        id: "my-image",
        props: { text: "hi" },
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await fetch(`${baseUrl}/image/${segment}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(PNG_BYTES));
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
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const segment = await signFnSegment(
      {
        id: "my-effie",
        props: {},
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await fetch(`${baseUrl}/effie/${segment}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(effieValue);
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
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const segment = await signFnSegment(
      {
        id: "my-annie",
        props: {},
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await fetch(`${baseUrl}/annie/${segment}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-tar");
    const buf = Buffer.from(await res.arrayBuffer());
    // TAR consists of 512-byte blocks; two frames + headers should be a few KB.
    expect(buf.byteLength).toBeGreaterThan(512);
  });

  test("returns 400 for an unsigned / tampered segment", async () => {
    const loader = makeLoader({
      image: {
        x: makeImageModule(z.object({}).passthrough(), async () => PNG_BYTES),
      },
    });
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const res = await fetch(`${baseUrl}/image/garbage-segment`);
    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown id", async () => {
    const loader = makeLoader({ image: {} });
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const segment = await signFnSegment(
      {
        id: "ghost",
        props: {},
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await fetch(`${baseUrl}/image/${segment}`);
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
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const segment = await signFnSegment(
      {
        id: "strict",
        props: { text: 123 }, // wrong type
        bounds: { width: 100, height: 100 },
      },
      SECRET,
    );
    const res = await fetch(`${baseUrl}/image/${segment}`);
    expect(res.status).toBe(400);
  });

  test("returns 404 on unknown route shape", async () => {
    const loader = makeLoader({});
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const res = await fetch(`${baseUrl}/nope/whatever`);
    expect(res.status).toBe(404);
  });

  test("returns 405 for non-GET", async () => {
    const loader = makeLoader({});
    const { server, baseUrl } = await startServer(loader);
    cleanups.push(() => new Promise((r) => server.close(() => r())));

    const res = await fetch(`${baseUrl}/image/x`, { method: "POST" });
    expect(res.status).toBe(405);
  });
});
