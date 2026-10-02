import fs from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild, type Metafile, type Plugin } from "esbuild";
import { loadConfig } from "../config/load";
import { resolveFns, FN_KINDS, type ResolvedFns } from "../fns";

export type BuildOptions = {
  config?: string;
  outFile?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const entryPoint = prodEntryPath();
  const outFile = path.resolve(configDir, options.outFile ?? "dist/server.js");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const result = await esbuild({
    entryPoints: [entryPoint],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    // Inline everything except node built-ins and @effing/canvas. Its Skia
    // backend is a native addon, whose `.node` binding a JS bundler can't
    // embed, and the backend is a dependency of @effing/canvas, not of the
    // project: only from inside @effing/canvas's own install can Node always
    // find it (pnpm links nothing else into the project). So the bundle
    // imports @effing/canvas, which the project lists, and Node resolves the
    // backend from there. The backends themselves stay external too, for
    // code that imports one directly. Using `packages: "external"` instead
    // would keep workspace deps unbundled, and workspace packages that ship
    // raw TypeScript (`"main": "src/index.ts"`) then crash node with
    // ERR_UNKNOWN_FILE_EXTENSION ".ts" at runtime.
    external: ["node:*", "@effing/canvas", "@effing/skia", "@napi-rs/canvas"],
    metafile: true,
    logLevel: "info",
    plugins: [effingFnsPlugin(resolved)],
    banner: {
      // Make the bundle directly runnable with `node dist/server.js`.
      js: '#!/usr/bin/env node\nimport { createRequire as _effingCreateRequire } from "node:module";\nconst require = _effingCreateRequire(import.meta.url);',
    },
    sourcemap: true,
  });

  const missing = unresolvableImports(result.metafile, outFile);
  if (missing.length > 0) {
    throw new Error(
      `The bundle imports ${missing.join(", ")}, which Node can't find from ${path.dirname(outFile)}. ` +
        `Add ${missing.length > 1 ? "them" : "it"} to your project's dependencies.`,
    );
  }

  const size = fs.statSync(outFile).size;
  console.log(
    `Built ${outFile} (${formatSize(size)}) — image: ${resolved.image.length}, annie: ${resolved.annie.length}, effie: ${resolved.effie.length}`,
  );
  console.log(`\nRun with: node ${path.relative(configDir, outFile)}`);
}

/**
 * The packages the bundle imports at runtime that Node would not find from
 * where the bundle sits: looked up the way Node does, in the `node_modules`
 * of the bundle's directory and of each directory above it.
 */
export function unresolvableImports(
  metafile: Metafile,
  outFile: string,
): string[] {
  const packages = new Set<string>();
  for (const output of Object.values(metafile.outputs)) {
    for (const imported of output.imports) {
      if (!imported.external || isBuiltin(imported.path)) continue;
      if (imported.path.startsWith(".") || path.isAbsolute(imported.path)) {
        continue;
      }
      const [first, second] = imported.path.split("/");
      packages.add(first!.startsWith("@") ? `${first}/${second}` : first!);
    }
  }
  return [...packages].filter((name) => !isInstalledFor(name, outFile)).sort();
}

function isInstalledFor(name: string, file: string): boolean {
  let dir = path.dirname(path.resolve(file));
  for (;;) {
    if (fs.existsSync(path.join(dir, "node_modules", name, "package.json"))) {
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

function prodEntryPath(): string {
  // Layouts:
  //  - bundled CLI: dist/cli/index.js → ../server/prod/entry.js
  //  - in-repo src: src/cli/build.ts  → ../server/prod/entry.ts
  const candidates = [
    path.resolve(__dirname, "../server/prod/entry.js"),
    path.resolve(__dirname, "../server/prod/entry.ts"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `Could not locate prod entry — tried:\n  ${candidates.join("\n  ")}`,
  );
}

function effingFnsPlugin(resolved: ResolvedFns): Plugin {
  return {
    name: "effing-fns",
    setup(build) {
      build.onResolve({ filter: /^virtual:effing\/fns$/ }, (args) => ({
        path: args.path,
        namespace: "effing-fns",
      }));
      build.onLoad({ filter: /.*/, namespace: "effing-fns" }, () => ({
        contents: renderFnsMap(resolved),
        // resolveDir so esbuild can locate transitive packages (e.g. user's
        // own node_modules) from the absolute paths embedded below.
        resolveDir: process.cwd(),
        loader: "ts",
      }));
    },
  };
}

function renderFnsMap(resolved: ResolvedFns): string {
  const lines: string[] = [];
  const nameOf = (kind: string, idx: number) => `_${kind}_${idx}`;

  for (const kind of FN_KINDS) {
    resolved[kind].forEach((entry, idx) => {
      lines.push(
        `import * as ${nameOf(kind, idx)} from ${JSON.stringify(entry.absPath)};`,
      );
    });
  }
  lines.push("");
  lines.push("export const modulesByKind = {");
  for (const kind of FN_KINDS) {
    lines.push(`  ${kind}: {`);
    resolved[kind].forEach((entry, idx) => {
      lines.push(`    ${JSON.stringify(entry.id)}: ${nameOf(kind, idx)},`);
    });
    lines.push("  },");
  }
  lines.push("};");
  return lines.join("\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
