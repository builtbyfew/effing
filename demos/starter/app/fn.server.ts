import {
  initFnRuntime,
  type FnKind,
  type FnModule,
  type FnModuleLoader,
  type FnUrlBuilder,
} from "@effing/fn";
import { serialize } from "@effing/serde";
import { effieWebUrl } from "@effing/effie";
import invariant from "tiny-invariant";

function parseGlobModules(
  globs: Record<string, () => Promise<unknown>>,
  suffix: string,
) {
  return Object.fromEntries(
    Object.entries(globs).map(([key, load]) => {
      const id = key.split("/").pop()!.replace(suffix, "");
      return [id, load];
    }),
  );
}

const modulesByKind: Record<FnKind, Record<string, () => Promise<unknown>>> = {
  image: parseGlobModules(import.meta.glob("./images/*.fn.tsx"), ".fn.tsx"),
  annie: parseGlobModules(import.meta.glob("./annies/*.fn.tsx"), ".fn.tsx"),
  effie: parseGlobModules(import.meta.glob("./effies/*.fn.tsx"), ".fn.tsx"),
};

const moduleLoader: FnModuleLoader = {
  async loadModule<K extends FnKind>(kind: K, id: string) {
    const modules = modulesByKind[kind];
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
  listModules: (kind) => Object.keys(modulesByKind[kind]),
  hasModule: (kind, id) => id in modulesByKind[kind],
};

const kindPrefix = { image: "im", annie: "an", effie: "ff" } as const;

const urlBuilder: FnUrlBuilder = {
  async buildUrl(kind, id, props, { width, height }) {
    const segment = await serialize({ id, props }, process.env.SECRET_KEY!);
    return effieWebUrl(
      `${process.env.BASE_URL!}/${kindPrefix[kind]}/${segment}?w=${width}&h=${height}`,
    );
  },
};

export function ensureFnRuntime() {
  initFnRuntime({ moduleLoader, urlBuilder });
}
