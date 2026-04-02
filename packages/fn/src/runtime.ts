import type { EffieWebUrl } from "@effing/effie";
import type {
  Bounds,
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
  bounds: Bounds,
): Promise<EffieWebUrl> {
  return getUrlBuilder().buildUrl(kind, id, props, bounds);
}

export function fnModuleIds(kind: FnKind): string[] {
  return getModuleLoader().listModules(kind);
}

export function fnModuleExists(kind: FnKind, id: string): boolean {
  return getModuleLoader().hasModule(kind, id);
}
