import fs from "node:fs";
import path from "node:path";
import { createServer as createViteServer, type Plugin } from "vite";
import { effingVite, previewSrcDir } from "./vite-plugin";
import type { EffingConfig } from "./config/schema";

const PREVIEW_STAGE_DIR = ".effing-preview";

// Packages used by the preview app but not by user fn code. We expose them
// inside the user's `node_modules` via symlinks at dev start so Vite's
// resolver finds them through the standard path — without forcing the user
// to declare them in their own `package.json`.
const HOISTED_DEPS = [
  "react",
  "react-dom",
  "react-router",
  "@react-router/dev",
  "@react-router/node",
  "isbot",
  "@effing/annie-player",
  "@effing/effie-preview",
  "tiny-invariant",
];

export type StartPreviewServerOptions = {
  configDir: string;
  config: EffingConfig;
  host: string;
  port: number;
};

export async function startPreviewServer(
  options: StartPreviewServerOptions,
): Promise<{ close: () => Promise<void> }> {
  // Copy the preview app into a staged dir inside the user's cwd. RR's Vite
  // plugin discovers route files relative to its `appDirectory`, so the
  // staged dir gives the plugin real on-disk paths inside Vite's root.
  const stagedDir = path.join(options.configDir, PREVIEW_STAGE_DIR);
  await fs.promises.rm(stagedDir, { recursive: true, force: true });
  await copyDir(previewSrcDir(), stagedDir);
  await writeReactRouterConfig(stagedDir);
  await writeViteConfig(stagedDir);
  await writeTsconfig(stagedDir);

  // Hoist preview-only deps into the user's `node_modules` so Vite can
  // resolve them from staged files via standard Node resolution. pnpm's
  // strict layout otherwise hides them inside `.pnpm/` cells.
  const hoistedLinks = await hoistDeps(options.configDir);

  const tsconfigPaths = await loadTsconfigPaths(options.configDir);

  // Serve the user's `public/` dir (favicon, robots.txt, etc.) at the root.
  // Vite root is the staged dir, so without this its own `public/` wouldn't
  // be discovered.
  const userPublicDir = path.join(options.configDir, "public");
  const publicDir = fs.existsSync(userPublicDir) ? userPublicDir : false;

  const vite = await createViteServer({
    root: stagedDir,
    configFile: path.join(stagedDir, "vite.config.ts"),
    publicDir,
    server: { host: options.host, port: options.port, strictPort: true },
    plugins: [
      ...(tsconfigPaths ? [tsconfigPaths] : []),
      effingVite({ root: options.configDir, config: options.config }),
    ],
    optimizeDeps: { exclude: ["@effing/canvas"] },
    ssr: { external: ["@effing/canvas"] },
    resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".json"] },
  });

  await vite.listen();

  return {
    async close() {
      await vite.close();
      await fs.promises
        .rm(stagedDir, { recursive: true, force: true })
        .catch(() => {});
      await Promise.all(
        hoistedLinks.map((link) => fs.promises.unlink(link).catch(() => {})),
      );
    },
  };
}

async function writeReactRouterConfig(stagedDir: string): Promise<void> {
  // RR's Vite plugin reads this from the Vite root. `appDirectory: "."` makes
  // root.tsx, routes.ts, entry.server.tsx, entry.client.tsx and routes/*
  // resolve relative to the staged dir.
  const content = `import type { Config } from "@react-router/dev/config";
export default { appDirectory: ".", ssr: true } satisfies Config;
`;
  await fs.promises.writeFile(
    path.join(stagedDir, "react-router.config.ts"),
    content,
    "utf8",
  );
}

async function writeViteConfig(stagedDir: string): Promise<void> {
  // RR's plugin requires a vite.config.ts on disk — it refuses to operate in
  // programmatic-only mode. We add `reactRouter()` here; other plugins are
  // merged in by the parent createViteServer() call.
  const content = `import { reactRouter } from "@react-router/dev/vite";
export default { plugins: [reactRouter()] };
`;
  await fs.promises.writeFile(
    path.join(stagedDir, "vite.config.ts"),
    content,
    "utf8",
  );
}

async function writeTsconfig(stagedDir: string): Promise<void> {
  const content = JSON.stringify(
    {
      compilerOptions: {
        lib: ["DOM", "DOM.Iterable", "ESNext"],
        types: ["node", "@react-router/node", "vite/client"],
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        isolatedModules: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      include: ["**/*.ts", "**/*.tsx"],
    },
    null,
    2,
  );
  await fs.promises.writeFile(
    path.join(stagedDir, "tsconfig.json"),
    content,
    "utf8",
  );
}

async function hoistDeps(configDir: string): Promise<string[]> {
  const nodeModules = path.join(configDir, "node_modules");
  await fs.promises.mkdir(nodeModules, { recursive: true });

  const created: string[] = [];
  for (const dep of HOISTED_DEPS) {
    const target = await resolvePackageDir(dep);
    if (!target) continue;
    const linkPath = path.join(nodeModules, dep);
    await fs.promises.mkdir(path.dirname(linkPath), { recursive: true });

    // Inspect existing state. We need to distinguish:
    //   1. user has the package as a real dep (don't touch)
    //   2. we hoisted it in a previous run and the link is still valid (reuse)
    //   3. we hoisted it but the link is stale / points elsewhere (replace)
    //   4. nothing there (create)
    let stat;
    try {
      stat = await fs.promises.lstat(linkPath);
    } catch {
      /* doesn't exist — fall through to create */
    }
    if (stat) {
      if (!stat.isSymbolicLink()) {
        // Real directory: user-managed, leave alone.
        continue;
      }
      const currentTarget = await fs.promises
        .readlink(linkPath)
        .catch(() => "");
      const resolved = path.isAbsolute(currentTarget)
        ? currentTarget
        : path.resolve(path.dirname(linkPath), currentTarget);
      if (resolved === target) {
        // Still pointing where we'd point it; track it for cleanup either way.
        created.push(linkPath);
        continue;
      }
      // Stale symlink from a previous crashed dev session — replace it.
      await fs.promises.unlink(linkPath).catch(() => {});
    }
    try {
      await fs.promises.symlink(target, linkPath, "dir");
      created.push(linkPath);
    } catch {
      // ignore failures (e.g., race with another dev server)
    }
  }
  return created;
}

async function resolvePackageDir(pkg: string): Promise<string | null> {
  // Different packages need different resolution paths:
  //  - Some don't expose `./package.json` in their `exports` map → can't use
  //    `${pkg}/package.json` direct resolution.
  //  - Some only expose `import` condition (e.g. `@effing/annie-player`) →
  //    require.resolve fails; need `import.meta.resolve` (ESM resolver).
  //  - Some have no bare-name main entry (e.g. `@react-router/dev` only
  //    exposes subpaths) → bare resolve throws.
  // Strategy: try multiple resolvers and walk up to find package.json.
  const { createRequire } = await import("node:module");
  const { fileURLToPath } = await import("node:url");
  const req = createRequire(import.meta.url);

  // 1. Direct package.json resolution (works when ./package.json is exported).
  try {
    return path.dirname(req.resolve(`${pkg}/package.json`));
  } catch {
    /* try next */
  }
  try {
    const url = import.meta.resolve(`${pkg}/package.json`);
    if (url.startsWith("file:")) return path.dirname(fileURLToPath(url));
  } catch {
    /* try next */
  }

  // 2. Bare-specifier + parent-walk. Use whichever resolver succeeds.
  let mainPath: string | null = null;
  try {
    mainPath = req.resolve(pkg);
  } catch {
    /* try ESM resolver */
  }
  if (!mainPath) {
    try {
      const url = import.meta.resolve(pkg);
      if (url.startsWith("file:")) mainPath = fileURLToPath(url);
    } catch {
      /* unresolvable */
    }
  }
  if (!mainPath) return null;

  let dir = path.dirname(mainPath);
  while (dir && dir !== "/") {
    try {
      const pkgJson = JSON.parse(
        await fs.promises.readFile(path.join(dir, "package.json"), "utf8"),
      );
      if (pkgJson.name === pkg) return dir;
    } catch {
      /* not a package root; keep going */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.promises.copyFile(s, d);
    }
  }
}

async function loadTsconfigPaths(projectRoot: string): Promise<Plugin | null> {
  try {
    const mod = (await import("vite-tsconfig-paths")) as unknown as {
      default: (opts?: unknown) => Plugin;
    };
    return mod.default({ projects: [projectRoot] });
  } catch {
    return null;
  }
}

export { HOISTED_DEPS };
