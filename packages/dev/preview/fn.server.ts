import {
  initFnRuntime,
  type FnKind,
  type FnModule,
  type FnModuleLoader,
} from "@effing/fn";
import { createFlatUrlBuilder } from "@effing/fn/server";
import invariant from "tiny-invariant";
// @ts-expect-error virtual module provided by @effing/dev's Vite plugin.
import { modulesByKind } from "virtual:effing/fns";

type GlobModules = Record<string, () => Promise<unknown>>;
const typedModules = modulesByKind as Record<FnKind, GlobModules>;

const moduleLoader: FnModuleLoader = {
  async loadModule<K extends FnKind>(kind: K, id: string) {
    const modules = typedModules[kind];
    invariant(id in modules, `no ${kind} found for id '${id}'`);
    const mod = (await modules[id]()) as {
      runner: unknown;
      propsSchema: unknown;
      previewProps: unknown;
    };
    return {
      runner: mod.runner,
      propsSchema: mod.propsSchema,
      previewProps: mod.previewProps,
    } as FnModule<K>;
  },
  listModules: (kind) => Object.keys(typedModules[kind]),
  hasModule: (kind, id) => id in typedModules[kind],
};

let initialized = false;

export function ensureFnRuntime(): void {
  if (initialized) return;
  const baseUrl = process.env.BASE_URL;
  const secretKey = process.env.SECRET_KEY;
  invariant(baseUrl, "BASE_URL env var is required");
  invariant(secretKey, "SECRET_KEY env var is required");
  initFnRuntime({
    moduleLoader,
    urlBuilder: createFlatUrlBuilder({ baseUrl, secretKey }),
  });
  initialized = true;
}
