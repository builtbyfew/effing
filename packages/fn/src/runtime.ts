import type { EffieWebUrl } from "@effing/effie";
import type {
  Dimensions,
  FnKind,
  FnModule,
  FnModuleLoader,
  FnUrlBuilder,
} from "./types";

let moduleLoader: FnModuleLoader | null = null;
let urlBuilder: FnUrlBuilder | null = null;

export function initFnRuntime(config: {
  moduleLoader: FnModuleLoader;
  urlBuilder: FnUrlBuilder;
}): void {
  if (moduleLoader && urlBuilder) {
    if (
      config.moduleLoader !== moduleLoader ||
      config.urlBuilder !== urlBuilder
    ) {
      throw new Error("initFnRuntime() called with different config");
    }
    return;
  }
  moduleLoader = config.moduleLoader;
  urlBuilder = config.urlBuilder;
}

function getModuleLoader(): FnModuleLoader {
  if (!moduleLoader) {
    throw new Error(
      "attempting to access module loader before initFnRuntime() was called",
    );
  }
  return moduleLoader;
}

function getUrlBuilder(): FnUrlBuilder {
  if (!urlBuilder) {
    throw new Error(
      "attempting to access URL builder before initFnRuntime() was called",
    );
  }
  return urlBuilder;
}

export function fnModule<K extends FnKind>(
  kind: K,
  id: string,
): Promise<FnModule<K>> {
  return getModuleLoader().loadModule(kind, id);
}

export function fnUrl<P extends Record<string, unknown>>(
  kind: FnKind,
  id: string,
  props: P,
  dimensions: Dimensions,
): Promise<EffieWebUrl> {
  return getUrlBuilder().buildUrl(kind, id, props, dimensions);
}

export function fnModuleIds(kind: FnKind): string[] {
  return getModuleLoader().listModules(kind);
}

export function fnModuleExists(kind: FnKind, id: string): boolean {
  return getModuleLoader().hasModule(kind, id);
}
