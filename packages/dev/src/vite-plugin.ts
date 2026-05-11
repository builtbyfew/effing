import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { glob } from "tinyglobby";
import chokidar, { type FSWatcher } from "chokidar";
import { loadConfig } from "./config/load";
import {
  DEFAULT_RESOLUTIONS,
  type EffingConfig,
  type Resolution,
} from "./config/schema";

const FNS_VIRTUAL_ID = "virtual:effing/fns";
const CONFIG_VIRTUAL_ID = "virtual:effing/config";

type FnKind = "image" | "annie" | "effie";
const KINDS: FnKind[] = ["image", "annie", "effie"];
const SUFFIX = ".fn.tsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate the preview source directory. Lazy so importing this module doesn't
 * throw when the consumer (e.g. `effing build`) doesn't need it.
 *
 * Candidates cover three layouts:
 *  - bundled CLI: `dist/cli/index.js` → `../../preview`
 *  - bundled lib: `dist/vite-plugin.js` → `../preview`
 *  - in-monorepo dev: `src/vite-plugin.ts` → `./preview`
 */
export function previewSrcDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../preview"),
    path.resolve(__dirname, "../preview"),
    path.resolve(__dirname, "./preview"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "root.tsx"))) return c;
  }
  throw new Error(
    `Could not locate @effing/dev's preview source — tried:\n  ${candidates.join("\n  ")}`,
  );
}

export type EffingVitePluginOptions = {
  /** Project root — defaults to process.cwd(). */
  root?: string;
  /** Optional explicit path to the config file. */
  configFile?: string;
  /** Pre-loaded config — when set, skip reading the file from disk. */
  config?: EffingConfig;
};

type ResolvedFns = Record<FnKind, { id: string; absPath: string }[]>;

async function resolveFns(
  configDir: string,
  config: EffingConfig,
): Promise<ResolvedFns> {
  const out: ResolvedFns = { image: [], annie: [], effie: [] };
  for (const kind of KINDS) {
    const key = (kind + "s") as "images" | "annies" | "effies";
    const patterns = config[key];
    if (!patterns) continue;
    const arr = Array.isArray(patterns) ? patterns : [patterns];
    const matched = await glob(arr, { cwd: configDir, absolute: true });
    const seen = new Map<string, string>();
    for (const abs of matched) {
      const base = path.basename(abs);
      if (!base.endsWith(SUFFIX)) continue;
      const id = base.slice(0, -SUFFIX.length);
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

function renderFnsModule(resolved: ResolvedFns): string {
  // The virtual module is only imported from `fn.server.ts`, which RR's
  // `.server` convention strips from the client bundle. So static dynamic
  // imports are safe — the client optimizer never reaches user fn files.
  const lines: string[] = ["export const modulesByKind = {"];
  for (const kind of KINDS) {
    lines.push(`  ${kind}: {`);
    for (const { id, absPath } of resolved[kind]) {
      lines.push(
        `    ${JSON.stringify(id)}: () => import(${JSON.stringify(absPath)}),`,
      );
    }
    lines.push("  },");
  }
  lines.push("};");
  return lines.join("\n");
}

function renderConfigModule(config: EffingConfig): string {
  const resolutions: Resolution[] = config.resolutions ?? DEFAULT_RESOLUTIONS;
  return [
    `export const project = ${JSON.stringify(config.project)};`,
    `export const resolutions = ${JSON.stringify(resolutions)};`,
  ].join("\n");
}

function globRoots(configDir: string, config: EffingConfig): string[] {
  const roots = new Set<string>();
  for (const kind of KINDS) {
    const key = (kind + "s") as "images" | "annies" | "effies";
    const patterns = config[key];
    if (!patterns) continue;
    const arr = Array.isArray(patterns) ? patterns : [patterns];
    for (const p of arr) {
      // Strip glob magic to get a watchable dir.
      const dir = p.split("*")[0].replace(/[/\\]$/, "");
      roots.add(path.resolve(configDir, dir || "."));
    }
  }
  return [...roots];
}

export function effingVite(options: EffingVitePluginOptions = {}): Plugin {
  let cachedFnsId: string | null = null;
  let cachedConfigId: string | null = null;
  let watcher: FSWatcher | null = null;
  let cwd = options.root ?? process.cwd();
  let loaded: { config: EffingConfig; configDir: string } | null =
    options.config ? { config: options.config, configDir: cwd } : null;

  async function ensureLoaded(): Promise<{
    config: EffingConfig;
    configDir: string;
  }> {
    if (loaded) return loaded;
    const result = await loadConfig(cwd, options.configFile);
    loaded = { config: result.config, configDir: result.configDir };
    return loaded;
  }

  return {
    name: "effing-dev",
    enforce: "pre",
    async configResolved(resolved) {
      cwd = options.root ?? resolved.root;
    },
    async configureServer(server) {
      const { config, configDir } = await ensureLoaded();
      const roots = globRoots(configDir, config);
      watcher = chokidar.watch(roots, {
        ignoreInitial: true,
        ignored: /(^|[/\\])\../,
      });
      const onChange = (file: string) => {
        if (!file.endsWith(SUFFIX)) return;
        if (cachedFnsId) {
          const mod = server.moduleGraph.getModuleById(cachedFnsId);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      watcher.on("add", onChange);
      watcher.on("unlink", onChange);

      // Silence Chrome DevTools probes that would otherwise log noisy 404s.
      server.middlewares.use((req, res, next) => {
        if (req.url === "/.well-known/appspecific/com.chrome.devtools.json") {
          res.statusCode = 204;
          res.end();
          return;
        }
        next();
      });
    },
    async closeBundle() {
      await watcher?.close();
      watcher = null;
    },
    resolveId(source) {
      if (source === FNS_VIRTUAL_ID) {
        cachedFnsId = "\0" + FNS_VIRTUAL_ID;
        return cachedFnsId;
      }
      if (source === CONFIG_VIRTUAL_ID) {
        cachedConfigId = "\0" + CONFIG_VIRTUAL_ID;
        return cachedConfigId;
      }
      return null;
    },
    async load(id) {
      if (id === "\0" + FNS_VIRTUAL_ID) {
        const { config, configDir } = await ensureLoaded();
        const resolved = await resolveFns(configDir, config);
        return renderFnsModule(resolved);
      }
      if (id === "\0" + CONFIG_VIRTUAL_ID) {
        const { config } = await ensureLoaded();
        return renderConfigModule(config);
      }
      return null;
    },
  };
}

export default effingVite;
