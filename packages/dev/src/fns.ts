import path from "node:path";
import { glob } from "tinyglobby";
import type { EffingConfig } from "./config/schema";

export type FnKind = "image" | "annie" | "effie";

export const FN_KINDS: FnKind[] = ["image", "annie", "effie"];
export const FN_SUFFIX = ".fn.tsx";

export type ResolvedFns = Record<FnKind, { id: string; absPath: string }[]>;

export async function resolveFns(
  configDir: string,
  config: EffingConfig,
): Promise<ResolvedFns> {
  const out: ResolvedFns = { image: [], annie: [], effie: [] };
  for (const kind of FN_KINDS) {
    const key = (kind + "s") as "images" | "annies" | "effies";
    const patterns = config[key];
    if (!patterns) continue;
    const arr = Array.isArray(patterns) ? patterns : [patterns];
    const matched = await glob(arr, { cwd: configDir, absolute: true });
    const seen = new Map<string, string>();
    for (const abs of matched) {
      const base = path.basename(abs);
      if (!base.endsWith(FN_SUFFIX)) continue;
      const id = base.slice(0, -FN_SUFFIX.length);
      const existing = seen.get(id);
      if (existing && existing !== abs) {
        throw new Error(
          `Duplicate ${kind} id "${id}" — matched by both ${existing} and ${abs}. Ids must be unique per kind.`,
        );
      }
      seen.set(id, abs);
    }
    out[kind] = [...seen.entries()]
      .map(([id, absPath]) => ({ id, absPath }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  return out;
}
