import fs from "node:fs";
import path from "node:path";
import { build as esbuild } from "esbuild";
import { glob } from "tinyglobby";
import { loadConfig } from "../config/load";
import type { EffingConfig } from "../config/schema";

export type BuildOptions = {
  config?: string;
  outFile?: string;
};

type FnKind = "image" | "annie" | "effie";
const KINDS: FnKind[] = ["image", "annie", "effie"];
const SUFFIX = ".fn.tsx";

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { config, configDir, configPath } = await loadConfig(
    cwd,
    options.config,
  );
  console.log(`Loaded config from ${configPath}`);

  const resolved = await resolveFns(configDir, config);

  const total =
    resolved.image.length + resolved.annie.length + resolved.effie.length;
  if (total === 0) {
    throw new Error(
      `No fns matched. Set images/annies/effies in ${configPath} to paths that exist.`,
    );
  }

  const entry = renderEntry(resolved);
  const outFile = path.resolve(configDir, options.outFile ?? "dist/server.js");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  await esbuild({
    stdin: {
      contents: entry,
      resolveDir: configDir,
      loader: "tsx",
      sourcefile: "effing-server-entry.tsx",
    },
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    packages: "external",
    logLevel: "info",
    banner: {
      // Make the bundle directly runnable with `node dist/server.js`.
      js: '#!/usr/bin/env node\nimport { createRequire as _effingCreateRequire } from "node:module";\nconst require = _effingCreateRequire(import.meta.url);',
    },
    sourcemap: true,
  });

  const size = fs.statSync(outFile).size;
  console.log(
    `Built ${outFile} (${formatSize(size)}) — image: ${resolved.image.length}, annie: ${resolved.annie.length}, effie: ${resolved.effie.length}`,
  );
  console.log(`\nRun with: node ${path.relative(configDir, outFile)}`);
}

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
          `Duplicate ${kind} id "${id}" — matched by both ${existing} and ${abs}.`,
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

function renderEntry(resolved: ResolvedFns): string {
  const lines: string[] = [];
  lines.push(
    `import { createServer } from "node:http";`,
    `import {`,
    `  initFnRuntime,`,
    `  type FnKind,`,
    `  type FnModule,`,
    `  type FnModuleLoader,`,
    `} from "@effing/fn";`,
    `import {`,
    `  createFlatUrlBuilder,`,
    `  createFnHttpListener,`,
    `} from "@effing/fn/server";`,
    `import invariant from "tiny-invariant";`,
  );

  const nameOf = (kind: FnKind, idx: number) => `_${kind}_${idx}`;

  for (const kind of KINDS) {
    resolved[kind].forEach((entry, idx) => {
      lines.push(
        `import * as ${nameOf(kind, idx)} from ${JSON.stringify(entry.absPath)};`,
      );
    });
  }

  lines.push("");
  lines.push("const modulesByKind = {");
  for (const kind of KINDS) {
    lines.push(`  ${kind}: {`);
    resolved[kind].forEach((entry, idx) => {
      lines.push(`    ${JSON.stringify(entry.id)}: ${nameOf(kind, idx)},`);
    });
    lines.push(`  } as Record<string, FnModule<FnKind>>,`);
  }
  lines.push("};");
  lines.push("");
  lines.push(
    `const baseUrl = process.env.BASE_URL;`,
    `const secretKey = process.env.SECRET_KEY;`,
    `invariant(baseUrl, "BASE_URL env var is required");`,
    `invariant(secretKey, "SECRET_KEY env var is required");`,
    "",
    `const moduleLoader: FnModuleLoader = {`,
    `  async loadModule(kind, id) {`,
    `    const collection = modulesByKind[kind as FnKind];`,
    `    const mod = collection?.[id];`,
    `    if (!mod) throw new Error(\`no \${kind} found for id '\${id}'\`);`,
    `    return mod as any;`,
    `  },`,
    `  listModules(kind) { return Object.keys(modulesByKind[kind as FnKind] ?? {}); },`,
    `  hasModule(kind, id) { return Boolean(modulesByKind[kind as FnKind]?.[id]); },`,
    `};`,
    "",
    `initFnRuntime({`,
    `  moduleLoader,`,
    `  urlBuilder: createFlatUrlBuilder({ baseUrl: baseUrl!, secretKey: secretKey! }),`,
    `});`,
    "",
    `const listener = createFnHttpListener({ moduleLoader, secretKey: secretKey! });`,
    `const port = Number(process.env.PORT ?? 8080);`,
    `const host = process.env.HOST ?? "0.0.0.0";`,
    "",
    `createServer(listener).listen(port, host, () => {`,
    `  console.log(\`Effing fn server listening on http://\${host}:\${port}\`);`,
    `});`,
  );

  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
