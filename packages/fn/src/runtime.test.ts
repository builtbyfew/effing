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
      expect(() => fnModule("annie", "test")).toThrow("before initFnRuntime");
    });

    test("fnUrl throws", () => {
      expect(() =>
        fnUrl("annie", "test", {}, { width: 100, height: 100 }),
      ).toThrow("before initFnRuntime");
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
      const dimensions = { width: 1080, height: 1920 };
      await fnUrl("annie", "test", props, dimensions);
      expect(urlBuilder.buildUrl).toHaveBeenCalledWith(
        "annie",
        "test",
        props,
        dimensions,
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
