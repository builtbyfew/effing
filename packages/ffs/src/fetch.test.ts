import { describe, test, expect, vi } from "vitest";
import { Response } from "undici";
import { ffsFetch, sourceStream } from "./fetch";
import { FetchError } from "./handlers/errors";

describe("ffsFetch data URL support", () => {
  test("fetches text from data URL", async () => {
    const response = await ffsFetch("data:text/plain;base64,SGVsbG8gV29ybGQ=");
    expect(response.ok).toBe(true);
    expect(await response.text()).toBe("Hello World");
  });

  test("fetches binary from data URL", async () => {
    // 1x1 red PNG
    const response = await ffsFetch(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    );
    expect(response.ok).toBe(true);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

describe("sourceStream", () => {
  const url = "https://example.com/anim.tar";

  test("names the source when its body fails", async () => {
    const terminated = new TypeError("terminated");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
      },
      pull(controller) {
        controller.error(terminated);
      },
    });
    const chunks: Buffer[] = [];
    const error = await (async () => {
      for await (const chunk of sourceStream(url, new Response(body)))
        chunks.push(chunk as Buffer);
    })().then(
      () => undefined,
      (err: unknown) => err,
    );
    expect(Buffer.concat(chunks)).toEqual(Buffer.from([1, 2, 3]));
    expect(error).toBeInstanceOf(FetchError);
    expect(error).toMatchObject({
      url,
      status: 200,
      message: `Failed to fetch ${url}: response body failed: terminated`,
      cause: terminated,
    });
  });

  test("doesn't fail before it's read", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new TypeError("terminated"));
      },
    });
    const stream = sourceStream(url, new Response(body));
    const onError = vi.fn();
    stream.on("error", onError);
    // Plenty of turns for an eagerly read body to fail the stream.
    for (let i = 0; i < 5; i++) await new Promise(setImmediate);
    expect(onError).not.toHaveBeenCalled();
    await expect(stream.toArray()).rejects.toBeInstanceOf(FetchError);
  });

  test("passes its own errors through, and stops the download", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(16));
      },
      cancel,
    });
    const stream = sourceStream(url, new Response(body));
    // As when a consumer (e.g. a failing frame transform) destroys it.
    const aborted = new Error("consumer failed");
    const error = await new Promise((resolve) => {
      stream.on("error", resolve);
      stream.once("data", () => stream.destroy(aborted));
    });
    expect(error).toBe(aborted);
    expect(cancel).toHaveBeenCalledOnce();
  });

  test("stops the download when destroyed", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(16));
      },
      cancel,
    });
    const stream = sourceStream(url, new Response(body));
    const onError = vi.fn();
    stream.on("error", onError);
    await new Promise((resolve) => {
      stream.on("close", resolve);
      stream.once("data", () => stream.destroy());
    });
    expect(onError).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
