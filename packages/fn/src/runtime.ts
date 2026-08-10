import type { EffieWebUrl } from "@effing/effie";
import type {
  Bounds,
  FnKind,
  FnModule,
  FnModuleLoader,
  FnUrlBuilder,
} from "./types";

/**
 * A self-contained fn runtime: the module loader and URL builder are captured
 * in the handle instead of living in module-global state, so multiple
 * runtimes with different configurations can coexist in one process.
 */
export interface FnRuntime {
  /** Load an fn module of the given kind by id. */
  fnModule<K extends FnKind>(kind: K, id: string): Promise<FnModule<K>>;
  /** Build a signed URL pointing at another fn's output. */
  fnUrl<P extends Record<string, unknown>>(
    kind: FnKind,
    id: string,
    props: P,
    bounds: Bounds,
  ): Promise<EffieWebUrl>;
  /** List the ids of all fn modules of the given kind. */
  fnModuleIds(kind: FnKind): string[];
  /** Check whether an fn module of the given kind exists. */
  fnModuleExists(kind: FnKind, id: string): boolean;
}

/**
 * Create an explicit fn runtime handle bound to the given module loader and
 * URL builder. Unlike {@link initFnRuntime}, this involves no global state:
 * each handle resolves through its own loader/builder, so independent
 * runtimes can be used side by side (e.g. in parallel tests or multi-tenant
 * servers).
 */
export function createFnRuntime(config: {
  moduleLoader: FnModuleLoader;
  urlBuilder: FnUrlBuilder;
}): FnRuntime {
  const { moduleLoader, urlBuilder } = config;
  return {
    fnModule: (kind, id) => moduleLoader.loadModule(kind, id),
    fnUrl: (kind, id, props, bounds) =>
      urlBuilder.buildUrl(kind, id, props, bounds),
    fnModuleIds: (kind) => moduleLoader.listModules(kind),
    fnModuleExists: (kind, id) => moduleLoader.hasModule(kind, id),
  };
}

let globalRuntime: FnRuntime | null = null;

/**
 * Initialize the process-global fn runtime used by the standalone
 * {@link fnModule}, {@link fnUrl}, {@link fnModuleIds} and
 * {@link fnModuleExists} functions. This is a thin shim over
 * {@link createFnRuntime}; prefer an explicit runtime handle when more than
 * one configuration must coexist in a process.
 */
export function initFnRuntime(config: {
  moduleLoader: FnModuleLoader;
  urlBuilder: FnUrlBuilder;
}): void {
  globalRuntime = createFnRuntime(config);
}

function requireGlobalRuntime(subject: string): FnRuntime {
  if (!globalRuntime) {
    throw new Error(
      `attempting to access ${subject} before initFnRuntime() was called`,
    );
  }
  return globalRuntime;
}

export function fnModule<K extends FnKind>(
  kind: K,
  id: string,
): Promise<FnModule<K>> {
  return requireGlobalRuntime("module loader").fnModule(kind, id);
}

export function fnUrl<P extends Record<string, unknown>>(
  kind: FnKind,
  id: string,
  props: P,
  bounds: Bounds,
): Promise<EffieWebUrl> {
  return requireGlobalRuntime("URL builder").fnUrl(kind, id, props, bounds);
}

export function fnModuleIds(kind: FnKind): string[] {
  return requireGlobalRuntime("module loader").fnModuleIds(kind);
}

export function fnModuleExists(kind: FnKind, id: string): boolean {
  return requireGlobalRuntime("module loader").fnModuleExists(kind, id);
}
