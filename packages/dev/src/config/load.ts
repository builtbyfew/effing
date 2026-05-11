import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { build as esbuild } from "esbuild";
import { effingConfigSchema, type EffingConfig } from "./schema";

const CONFIG_FILENAMES = [
  "effing.config.ts",
  "effing.config.mts",
  "effing.config.js",
  "effing.config.mjs",
];

export type LoadedConfig = {
  config: EffingConfig;
  configPath: string;
  configDir: string;
};

export function findConfigFile(cwd: string, explicit?: string): string {
  if (explicit) {
    const resolved = path.isAbsolute(explicit)
      ? explicit
      : path.resolve(cwd, explicit);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    return resolved;
  }
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.resolve(cwd, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `No effing.config.ts found in ${cwd}. Create one with \`export default defineConfig({ project: "..." })\` or pass --config <path>.`,
  );
}

function stubPlugin() {
  // Stub out `@effing/dev` so users can `import { defineConfig } from "@effing/dev"`
  // inside their config file. esbuild would otherwise try to resolve and bundle
  // the entire package just to run a config that needs only the identity function.
  return {
    name: "effing-dev-stub",
    setup(build: {
      onResolve: (
        opts: { filter: RegExp },
        cb: (args: { path: string }) => { path: string; namespace: string },
      ) => void;
      onLoad: (
        opts: { filter: RegExp; namespace: string },
        cb: () => { contents: string; loader: "js" },
      ) => void;
    }) {
      build.onResolve({ filter: /^@effing\/dev$/ }, (args) => ({
        path: args.path,
        namespace: "effing-dev-stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "effing-dev-stub" }, () => ({
        contents: "export const defineConfig = (c) => c;",
        loader: "js",
      }));
    },
  };
}

export async function loadConfig(
  cwd: string,
  explicit?: string,
): Promise<LoadedConfig> {
  const configPath = findConfigFile(cwd, explicit);
  const configDir = path.dirname(configPath);
  const tempFile = path.join(
    configDir,
    `.effing.config.${randomBytes(4).toString("hex")}.mjs`,
  );

  try {
    await esbuild({
      entryPoints: [configPath],
      outfile: tempFile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      packages: "external",
      plugins: [stubPlugin()],
      logLevel: "silent",
    });

    const mod = (await import(pathToFileURL(tempFile).href)) as {
      default?: unknown;
    };
    if (!mod.default) {
      throw new Error(
        `${configPath} has no default export. Use \`export default defineConfig({...})\`.`,
      );
    }
    const parsed = effingConfigSchema.safeParse(mod.default);
    if (!parsed.success) {
      throw new Error(
        `Invalid config in ${configPath}:\n${parsed.error.message}`,
      );
    }
    return { config: parsed.data, configPath, configDir };
  } finally {
    await fs.promises.unlink(tempFile).catch(() => {});
  }
}
