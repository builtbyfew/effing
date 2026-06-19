import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import invariant from "tiny-invariant";
import {
  createServer as createViteServer,
  createServerModuleRunner,
} from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { createRequestListener } from "@react-router/node";
import type { FnModule, FnModuleLoader } from "@effing/fn";
import {
  FN_SUFFIX,
  resolveFns,
  type FnKind,
  type ResolvedFns,
} from "../../fns";
import { DEFAULT_RESOLUTIONS, type EffingConfig } from "../../config/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type StartDevServerOptions = {
  configDir: string;
  config: EffingConfig;
  host: string;
  port: number;
  /**
   * Fail on EADDRINUSE instead of trying the next port. Set when the port was
   * chosen explicitly (CLI flag or config) — a collision then usually means
   * another instance of the same project is already running.
   */
  strictPort?: boolean;
};

export async function startDevServer(
  options: StartDevServerOptions,
): Promise<{ port: number; close: () => Promise<void> }> {
  // Mutable snapshot, refreshed when fn files are added/removed.
  let resolved: ResolvedFns = await resolveFns(
    options.configDir,
    options.config,
  );

  // Vite in middleware mode: serves no HTTP traffic and hosts no client
  // assets. Its only job is to back `createServerModuleRunner`, which
  // transforms + evaluates user fn files through the SSR module graph.
  const vite = await createViteServer({
    root: options.configDir,
    // `ws: false` matters alongside `hmr: false`: in middleware mode Vite
    // otherwise still binds its HMR WebSocket server on its own port (24678),
    // which collides across instances. Reload uses our SSE channel, and the
    // module runner talks in-process, so the WS server is unused anyway.
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true },
    ssr: {
      external: [
        // `@effing/canvas` wraps `@napi-rs/canvas`, a native N-API addon
        // (`.node` binary). Bundlers can't process native code; leaving it
        // external defers loading to Node's runtime require resolver.
        "@effing/canvas",
        // `@effing/fn` holds module-level singleton state (the fn runtime's
        // moduleLoader + urlBuilder). The pre-built preview handler and the
        // runner-loaded user fns each evaluate their imports independently —
        // routing both through Node's process-wide import cache is the only
        // way they end up reading from the same singleton.
        "@effing/fn",
      ],
    },
    resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".json"] },
    plugins: [tsconfigPaths({ projects: [options.configDir] })],
  });

  const runner = createServerModuleRunner(vite.environments.ssr);

  const findAbsPath = (kind: FnKind, id: string): string | undefined =>
    resolved[kind].find((f) => f.id === id)?.absPath;

  const fnLoader: FnModuleLoader = {
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
    listModules: (kind) => resolved[kind].map((f) => f.id),
    hasModule: (kind, id) => findAbsPath(kind, id) !== undefined,
  };

  // Install runtime context on globalThis BEFORE importing the pre-built
  // handler. The preview's `fn.server.ts` / `resolutions.server.ts` read
  // these on every request, so installing them up front keeps the first
  // request from racing against initialization.
  globalThis.__effingDevFnModuleLoader = fnLoader;
  globalThis.__effingDevResolutions =
    options.config.dev?.resolutions ?? DEFAULT_RESOLUTIONS;
  globalThis.__effingDevProjectName = options.config.project;

  // Pre-built RR Node server. We import dynamically so this module can be
  // typechecked / bundled before the preview build artifact exists.
  const buildDir = appBuildDir();
  const build = await import(
    /* @vite-ignore */ path.join(buildDir, "server/index.js")
  );
  const rrListener = createRequestListener({ build, mode: "development" });

  // SSE channel used by the reload script injected in root.tsx.
  const sseClients = new Set<http.ServerResponse>();
  const broadcastReload = (): void => {
    if (sseClients.size === 0) return;
    for (const c of sseClients) {
      try {
        c.write("event: reload\ndata:\n\n");
      } catch {
        // client dropped; cleanup runs on its own "close" handler
      }
    }
  };

  const clientDir = path.join(buildDir, "client");
  const faviconFile = faviconPath();

  // Reuse Vite's own chokidar watcher (rooted at options.configDir) instead
  // of standing up a second one. On content edits, Vite's SSR module graph
  // has already invalidated the file by the time this fires — we just need
  // to nudge the browser. On add/unlink, the SET of fns changes, so we
  // re-resolve the id→absPath map before broadcasting.
  //
  // A content edit reloads when the file is either an fn itself or a module
  // some rendered fn imports (directly or transitively) — i.e. it lives in
  // the SSR module graph, so a re-render will reflect the edit. This picks up
  // shared helpers (fonts, utils) while ignoring files no render depends on
  // (config, tests, unused modules). The lookup matches reliably because Vite
  // invalidated this exact `file` string against the same graph moments
  // earlier, on the same watcher event.
  const isRenderedDep = (file: string): boolean => {
    const mods = vite.environments.ssr.moduleGraph.getModulesByFile(file);
    return mods !== undefined && mods.size > 0;
  };
  const onAddOrUnlink = (file: string) => {
    if (!file.endsWith(FN_SUFFIX)) return;
    void resolveFns(options.configDir, options.config).then((r) => {
      resolved = r;
      broadcastReload();
    });
  };
  const onChange = (file: string) => {
    if (!file.endsWith(FN_SUFFIX) && !isRenderedDep(file)) return;
    broadcastReload();
  };
  vite.watcher.on("add", onAddOrUnlink);
  vite.watcher.on("unlink", onAddOrUnlink);
  vite.watcher.on("change", onChange);

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (url === "/__effing/reload") {
      handleSseRequest(req, res, sseClients);
      return;
    }
    if (url === "/.well-known/appspecific/com.chrome.devtools.json") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const pathname = url.split("?", 1)[0];
    if (pathname.startsWith("/assets/")) {
      // Vite emits hashed filenames, so the contents are immutable for the
      // lifetime of a build. Cache aggressively so reloads only fetch new
      // hashes.
      if (await tryServeStatic(clientDir, pathname, res, IMMUTABLE_CACHE))
        return;
    }
    if (pathname === "/favicon.ico") {
      // Dev-server branding shipped with @effing/dev — users can't override.
      if (
        await tryServeStatic(
          path.dirname(faviconFile),
          "/favicon.ico",
          res,
          REVALIDATE_CACHE,
        )
      )
        return;
    }

    rrListener(req, res);
  });

  const port = await listenWithRetry(
    server,
    options.host,
    options.port,
    options.strictPort ?? false,
  );

  return {
    port,
    async close() {
      for (const c of sseClients) {
        try {
          c.end();
        } catch {
          /* ignore */
        }
      }
      sseClients.clear();
      await new Promise<void>((resolveClose) => {
        server.close(() => resolveClose());
        // Force-close hanging keep-alive connections so close() can resolve.
        server.closeAllConnections?.();
      });
      vite.watcher.off("add", onAddOrUnlink);
      vite.watcher.off("unlink", onAddOrUnlink);
      vite.watcher.off("change", onChange);
      await runner.close();
      await vite.close();
      if (globalThis.__effingDevFnModuleLoader === fnLoader) {
        globalThis.__effingDevFnModuleLoader = undefined;
        globalThis.__effingDevResolutions = undefined;
        globalThis.__effingDevProjectName = undefined;
      }
    },
  };
}

const MAX_PORT_ATTEMPTS = 16;

/**
 * Bind the server, walking up from `port` on EADDRINUSE unless `strict`.
 * Retrying on the actual listen (rather than probing first) avoids the
 * race where another process grabs the port between probe and bind.
 */
async function listenWithRetry(
  server: http.Server,
  host: string,
  port: number,
  strict: boolean,
): Promise<number> {
  const attempts = strict ? 1 : MAX_PORT_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const candidate = port + i;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(candidate, host, () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      return candidate;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
      if (strict) {
        throw new Error(
          `Port ${candidate} on ${host} is already in use — is another dev ` +
            `server running? Pass --port or set dev.port to pick a different one.`,
        );
      }
    }
  }
  throw new Error(
    `Ports ${port}–${port + attempts - 1} on ${host} are all in use.`,
  );
}

function appBuildDir(): string {
  // Layouts:
  //  - bundled CLI:    dist/cli/index.js        → ../server/dev/app
  //  - in-repo source: src/server/dev/host.ts   → ../../../dist/server/dev/app
  const candidates = [
    path.resolve(__dirname, "../server/dev/app"),
    path.resolve(__dirname, "../../../dist/server/dev/app"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "server/index.js"))) return c;
  }
  throw new Error(
    `Could not locate the built dev app — tried:\n  ${candidates.join("\n  ")}\n` +
      `Run \`pnpm --filter @effing/dev build\` to produce it.`,
  );
}

function faviconPath(): string {
  // Layouts:
  //  - bundled CLI:    dist/cli/index.js        → ../../assets/favicon.ico
  //  - in-repo source: src/server/dev/host.ts   → ../../../assets/favicon.ico
  const candidates = [
    path.resolve(__dirname, "../../assets/favicon.ico"),
    path.resolve(__dirname, "../../../assets/favicon.ico"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `Could not locate bundled favicon — tried:\n  ${candidates.join("\n  ")}`,
  );
}

function handleSseRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  clients: Set<http.ServerResponse>,
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  // Initial comment unblocks any proxy buffering and confirms the connection.
  res.write(":\n\n");
  clients.add(res);
  req.on("close", () => {
    clients.delete(res);
  });
}

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const REVALIDATE_CACHE = "public, max-age=0, must-revalidate";

async function tryServeStatic(
  rootDir: string,
  urlPath: string,
  res: http.ServerResponse,
  cacheControl: string,
): Promise<boolean> {
  // Defend against path traversal — resolve and confirm we stayed in rootDir.
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return false;
  }
  const filePath = path.resolve(rootDir, "." + decoded);
  if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
    return false;
  }
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
    "Content-Length": String(stat.size),
    "Cache-Control": cacheControl,
  });
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res, { end: true });
  });
  return true;
}
