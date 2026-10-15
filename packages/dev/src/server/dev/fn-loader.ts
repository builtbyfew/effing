import invariant from "tiny-invariant";
import type { FnModule, FnModuleLoader } from "@effing/fn";
import type { ModuleRunner } from "vite/module-runner";
import type { FnKind, ResolvedFns } from "../../fns";

/**
 * The fn module loader the dev app reads from `globalThis`: fns are imported
 * through `runner`, so they're transformed by Vite, and looked up in the
 * current `fns` snapshot, which changes as fn files are added or removed.
 */
export function createFnLoader(
  runner: Pick<ModuleRunner, "import">,
  fns: () => ResolvedFns,
): FnModuleLoader {
  const findAbsPath = (kind: FnKind, id: string): string | undefined =>
    fns()[kind].find((f) => f.id === id)?.absPath;

  return {
    async loadModule<K extends FnKind>(kind: K, id: string) {
      const absPath = findAbsPath(kind, id);
      invariant(absPath, `no ${kind} found for id '${id}'`);
      const mod = (await runner.import(absPath)) as FnModule<K>;
      return {
        runner: mod.runner,
        propsSchema: mod.propsSchema,
        previewProps: mod.previewProps,
      } as FnModule<K>;
    },
    listModules: (kind) => fns()[kind].map((f) => f.id),
    hasModule: (kind, id) => findAbsPath(kind, id) !== undefined,
  };
}
