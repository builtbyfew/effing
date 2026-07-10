import { describe, test, expect, beforeEach, vi } from "vitest";
import type { FnModuleLoader, FnUrlBuilder } from "./types";

function createMockLoader(): FnModuleLoader {
  return {
    loadModule: vi.fn().mockResolvedValue({
      runner: vi.fn(),
      propsSchema: { parse: vi.fn(), safeParse: vi.fn() },
      previewProps: {},
    }),
    listModules: vi.fn().mockReturnValue(["test-module"]),
    hasModule: vi.fn().mockReturnValue(true),
  };
}

function createMockUrlBuilder(): FnUrlBuilder {
  return {
    buildUrl: vi.fn().mockResolvedValue("https://example.com/test" as const),
  };
}

describe("createFnRuntime", () => {
  let createFnRuntime: typeof import("./runtime").createFnRuntime;

  beforeEach(async () => {
    vi.resetModules();
    ({ createFnRuntime } = await import("./runtime"));
  });

  test("fnModule delegates to loader.loadModule", async () => {
    const loader = createMockLoader();
    const runtime = createFnRuntime({
      moduleLoader: loader,
      urlBuilder: createMockUrlBuilder(),
    });

    await runtime.fnModule("annie", "photo-zoom");
    expect(loader.loadModule).toHaveBeenCalledWith("annie", "photo-zoom");
  });

  test("fnUrl delegates to urlBuilder.buildUrl", async () => {
    const urlBuilder = createMockUrlBuilder();
    const runtime = createFnRuntime({
      moduleLoader: createMockLoader(),
      urlBuilder,
    });

    const props = { text: "hello" };
    const bounds = { width: 1080, height: 1920 };
    await runtime.fnUrl("annie", "test", props, bounds);
    expect(urlBuilder.buildUrl).toHaveBeenCalledWith(
      "annie",
      "test",
      props,
      bounds,
    );
  });

  test("fnModuleIds delegates to loader.listModules", () => {
    const loader = createMockLoader();
    const runtime = createFnRuntime({
      moduleLoader: loader,
      urlBuilder: createMockUrlBuilder(),
    });

    runtime.fnModuleIds("effie");
    expect(loader.listModules).toHaveBeenCalledWith("effie");
  });

  test("fnModuleExists delegates to loader.hasModule", () => {
    const loader = createMockLoader();
    const runtime = createFnRuntime({
      moduleLoader: loader,
      urlBuilder: createMockUrlBuilder(),
    });

    runtime.fnModuleExists("image", "cover");
    expect(loader.hasModule).toHaveBeenCalledWith("image", "cover");
  });

  test("two runtimes resolve through their own loaders and builders", async () => {
    const firstLoader = createMockLoader();
    const firstUrlBuilder = createMockUrlBuilder();
    const first = createFnRuntime({
      moduleLoader: firstLoader,
      urlBuilder: firstUrlBuilder,
    });

    const secondLoader = createMockLoader();
    const secondUrlBuilder = createMockUrlBuilder();
    const second = createFnRuntime({
      moduleLoader: secondLoader,
      urlBuilder: secondUrlBuilder,
    });

    await first.fnModule("annie", "photo-zoom");
    second.fnModuleIds("image");
    await second.fnUrl("effie", "slideshow", {}, { width: 100, height: 100 });

    expect(firstLoader.loadModule).toHaveBeenCalledWith("annie", "photo-zoom");
    expect(secondLoader.loadModule).not.toHaveBeenCalled();

    expect(secondLoader.listModules).toHaveBeenCalledWith("image");
    expect(firstLoader.listModules).not.toHaveBeenCalled();

    expect(secondUrlBuilder.buildUrl).toHaveBeenCalledWith(
      "effie",
      "slideshow",
      {},
      { width: 100, height: 100 },
    );
    expect(firstUrlBuilder.buildUrl).not.toHaveBeenCalled();
  });

  test("works without initFnRuntime being called", async () => {
    const loader = createMockLoader();
    const runtime = createFnRuntime({
      moduleLoader: loader,
      urlBuilder: createMockUrlBuilder(),
    });

    await runtime.fnModule("image", "cover");
    expect(loader.loadModule).toHaveBeenCalledWith("image", "cover");
  });
});

describe("runtime", () => {
  let initFnRuntime: typeof import("./runtime").initFnRuntime;
  let fnModule: typeof import("./runtime").fnModule;
  let fnUrl: typeof import("./runtime").fnUrl;
  let fnModuleIds: typeof import("./runtime").fnModuleIds;
  let fnModuleExists: typeof import("./runtime").fnModuleExists;

  beforeEach(async () => {
    vi.resetModules();
    ({ initFnRuntime, fnModule, fnUrl, fnModuleIds, fnModuleExists } =
      await import("./runtime"));
  });

  describe("before initFnRuntime", () => {
    test("fnModule throws", () => {
      expect(() => fnModule("annie", "test")).toThrow(
        "attempting to access module loader before initFnRuntime() was called",
      );
    });

    test("fnUrl throws", () => {
      expect(() =>
        fnUrl("annie", "test", {}, { width: 100, height: 100 }),
      ).toThrow(
        "attempting to access URL builder before initFnRuntime() was called",
      );
    });

    test("fnModuleIds throws", () => {
      expect(() => fnModuleIds("annie")).toThrow("before initFnRuntime");
    });

    test("fnModuleExists throws", () => {
      expect(() => fnModuleExists("annie", "test")).toThrow(
        "before initFnRuntime",
      );
    });
  });

  describe("after initFnRuntime", () => {
    test("fnModule delegates to loader.loadModule", async () => {
      const loader = createMockLoader();
      initFnRuntime({
        moduleLoader: loader,
        urlBuilder: createMockUrlBuilder(),
      });

      await fnModule("annie", "photo-zoom");
      expect(loader.loadModule).toHaveBeenCalledWith("annie", "photo-zoom");
    });

    test("fnUrl delegates to urlBuilder.buildUrl", async () => {
      const urlBuilder = createMockUrlBuilder();
      initFnRuntime({ moduleLoader: createMockLoader(), urlBuilder });

      const props = { text: "hello" };
      const bounds = { width: 1080, height: 1920 };
      await fnUrl("annie", "test", props, bounds);
      expect(urlBuilder.buildUrl).toHaveBeenCalledWith(
        "annie",
        "test",
        props,
        bounds,
      );
    });

    test("fnModuleIds delegates to loader.listModules", () => {
      const loader = createMockLoader();
      initFnRuntime({
        moduleLoader: loader,
        urlBuilder: createMockUrlBuilder(),
      });

      fnModuleIds("effie");
      expect(loader.listModules).toHaveBeenCalledWith("effie");
    });

    test("fnModuleExists delegates to loader.hasModule", () => {
      const loader = createMockLoader();
      initFnRuntime({
        moduleLoader: loader,
        urlBuilder: createMockUrlBuilder(),
      });

      fnModuleExists("image", "cover");
      expect(loader.hasModule).toHaveBeenCalledWith("image", "cover");
    });
  });

  describe("re-initialization", () => {
    test("same config is a no-op", () => {
      const loader = createMockLoader();
      const urlBuilder = createMockUrlBuilder();
      const config = { moduleLoader: loader, urlBuilder };

      initFnRuntime(config);
      expect(() => initFnRuntime(config)).not.toThrow();
    });

    test("different config replaces previous", () => {
      const firstLoader = createMockLoader();
      const firstUrlBuilder = createMockUrlBuilder();
      initFnRuntime({
        moduleLoader: firstLoader,
        urlBuilder: firstUrlBuilder,
      });

      const secondLoader = createMockLoader();
      initFnRuntime({
        moduleLoader: secondLoader,
        urlBuilder: createMockUrlBuilder(),
      });

      fnModuleIds("image");
      expect(secondLoader.listModules).toHaveBeenCalledWith("image");
      expect(firstLoader.listModules).not.toHaveBeenCalled();
    });
  });
});
