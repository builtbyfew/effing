import type { EvaluatedModuleNode, EvaluatedModules } from "vite/module-runner";

/**
 * Make a module runner re-fetch `file` on its next import: invalidate the
 * modules it evaluated from that file, and every module importing them,
 * directly or not, so their new exports are picked up too.
 *
 * Each app worker has a runner of its own over the dev server's single Vite
 * environment, but Vite tracks staleness per module, not per runner: a runner
 * that imports an evaluated module asks the server whether it changed, and the
 * server says no once any runner has fetched the new version. So each runner
 * must drop its own copies of an edited file, or it would keep running them
 * whenever another runner got to the edit first.
 */
export function invalidateFile(modules: EvaluatedModules, file: string): void {
  const pending = [...(modules.getModulesByFile(file) ?? [])];
  const seen = new Set<EvaluatedModuleNode>();
  for (let node = pending.pop(); node; node = pending.pop()) {
    if (seen.has(node)) continue;
    seen.add(node);
    // invalidateModule keeps `importers`, so the walk can go on from here.
    modules.invalidateModule(node);
    for (const id of node.importers) {
      const importer = modules.getModuleById(id);
      if (importer) pending.push(importer);
    }
  }
}
