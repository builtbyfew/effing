import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createServer as createViteServer,
  createServerModuleRunner,
  normalizePath,
  type HotPayload,
  type ViteDevServer,
} from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { FN_SUFFIX, resolveFns, type ResolvedFns } from "../../fns";
import {
  DEFAULT_RESOLUTIONS,
  type EffingConfig,
  type Resolution,
} from "../../config/schema";
import { createAppListener } from "./app-listener";
import { createAppWorkers, type DevApp } from "./app-workers";
import { createFnLoader } from "./fn-loader";
import { invalidateFile } from "./invalidate";

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

export type DevServer = {
  port: number;
  /**
   * Get ready for a burst of requests, as for a render: start app workers
   * now (half the pool) and import every fn in them, or import the fns on
   * this thread without workers, instead of on the first requests. Call it
   * once the environment the fns read (BASE_URL) is set.
   */
  prewarm: () => void;
  close: () => Promise<void>;
};

export async function startDevServer(
  options: StartDevServerOptions,
): Promise<DevServer> {
  // Mutable snapshot, refreshed when fn files are added/removed.
  let resolved: ResolvedFns = await resolveFns(
    options.configDir,
    options.config,
  );

  // Fns draw synchronously, so requests served on one thread take turns even
  // when they come in together (as FFS fetches the layers of an effie). Serve
  // the app on worker threads instead, each with its own module runner over
  // the Vite server below; `workers: 0` serves it on this thread.
  const workers = options.config.dev?.workers ?? defaultWorkerCount();
  // Find the built files before starting Vite, so a missing one fails early.
  const buildDir = appBuildDir();
  const workerFile = workers > 0 ? appWorkerPath() : undefined;
  const clientDir = path.join(buildDir, "client");
  const faviconFile = faviconPath();
  const resolutions = options.config.dev?.resolutions ?? DEFAULT_RESOLUTIONS;

  // Vite in middleware mode: serves no HTTP traffic and hosts no client
  // assets. Its only job is to back the module runners — this thread's or
  // each app worker's — that transform + evaluate user fn files through the
  // SSR module graph.
  const vite = await createViteServer({
    root: options.configDir,
    // `ws: false` matters alongside `hmr: false`: in middleware mode Vite
    // otherwise still binds its HMR WebSocket server on its own port (24678),
    // which collides across instances. Reload uses our SSE channel, and module
    // runners talk in-process or over worker ports, so the WS server is unused
    // anyway.
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true },
    ssr: {
      external: [
        // `@effing/canvas` wraps `@effing/skia`, a native N-API addon
        // (`.node` binary). Bundlers can't process native code; leaving it
        // external defers loading to Node's runtime require resolver.
        "@effing/canvas",
        // `@effing/fn` holds module-level singleton state (the fn runtime's
        // moduleLoader + urlBuilder). The pre-built preview handler and the
        // runner-loaded user fns each evaluate their imports independently —
        // routing both through Node's import cache (one per thread) is the
        // only way they end up reading from the same singleton.
        "@effing/fn",
      ],
    },
    resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".json"] },
    plugins: [tsconfigPaths({ projects: [options.configDir] })],
  });

  // From here on, a failure (e.g. a strict port that's taken) closes what
  // started: Vite's watcher would otherwise keep the process alive.
  let started: DevApp | undefined;
  try {
    const app: DevApp = workerFile
      ? createAppWorkers({
          size: workers,
          workerFile,
          data: () => ({
            buildDir,
            fns: resolved,
            resolutions,
            project: options.config.project,
          }),
          invoke: (payload) =>
            vite.environments.ssr.hot.handleInvoke(payload as HotPayload),
        })
      : await startInProcessApp(
          vite,
          () => resolved,
          buildDir,
          resolutions,
          options.config.project,
        );
    started = app;

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

    // Reuse Vite's own chokidar watcher (rooted at options.configDir) instead
    // of standing up a second one.
    //
    // A content edit reloads when the file is either an fn itself or a
    // module some rendered fn imports (directly or transitively) — i.e. it
    // lives in the SSR module graph, so a re-render will reflect the edit.
    // This picks up shared helpers (fonts, utils) while ignoring files no
    // render depends on (config, tests, unused modules). A module enters the
    // graph's fileToModulesMap when first transformed during a render and
    // stays there across edits — Vite's change handler only clears its
    // transform result — so presence is a stable signal independent of
    // handler ordering. Those map keys are stored normalized, so we must
    // normalize the raw chokidar path before the lookup; on macOS/Linux
    // normalizePath is a no-op, but on Windows chokidar emits backslash paths
    // and an un-normalized lookup would silently miss, quietly degrading to
    // fn-only reloads.
    const isRenderedDep = (file: string): boolean => {
      const mods = vite.environments.ssr.moduleGraph.getModulesByFile(
        normalizePath(file),
      );
      return mods !== undefined && mods.size > 0;
    };
    // add/unlink stays fn-scoped: adding or removing an fn changes the SET of
    // fns, so we re-resolve the id→absPath map before broadcasting. Helper
    // add/unlink is deliberately not handled — the module-graph signal is
    // unreliable at this boundary (a just-added file hasn't been transformed
    // into the graph yet, and an unlinked one is already evicted by Vite's own
    // delete handler before this fires), so there's nothing dependable to test
    // against. Editing a helper still reloads via onChange.
    const onAddOrUnlink = (file: string) => {
      if (!file.endsWith(FN_SUFFIX)) return;
      void resolveFns(options.configDir, options.config).then((r) => {
        resolved = r;
        app.setFns(r);
        broadcastReload();
      });
    };
    const onChange = (file: string) => {
      if (!file.endsWith(FN_SUFFIX) && !isRenderedDep(file)) return;
      // Every module runner drops its own copies of the file (see
      // invalidate.ts). Vite's own change handler invalidates the module
      // graph only after awaiting its plugins' watchChange hooks, so a runner
      // re-fetching before then would get the old transform back; invalidate
      // it here first (Vite's call is then a harmless repeat).
      const normalized = normalizePath(file);
      vite.environments.ssr.moduleGraph.onFileChange(normalized);
      app.invalidate(normalized);
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
        // Dev-server branding shipped with @effing/dev — users can't
        // override.
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

      app.handle(req, res);
    });

    const port = await listenWithRetry(
      server,
      options.host,
      options.port,
      options.strictPort ?? false,
    );

    return {
      port,
      prewarm: () => app.prewarm(),
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
          // Force-close hanging keep-alive connections so close() can
          // resolve.
          server.closeAllConnections?.();
        });
        vite.watcher.off("add", onAddOrUnlink);
        vite.watcher.off("unlink", onAddOrUnlink);
        vite.watcher.off("change", onChange);
        await app.close();
        await vite.close();
      },
    };
  } catch (err) {
    await started?.close();
    await vite.close();
    throw err;
  }
}

const MAX_PORT_ATTEMPTS = 16;

/**
 * Bind the server, walking up from `port` on EADDRINUSE unless `strict`.
 * Retrying on the actual listen (rather than probing first) avoids the
 * race where another process grabs the port between probe and bind.
 */
export async function listenWithRetry(
  server: http.Server,
  host: string,
  port: number,
  strict: boolean,
): Promise<number> {
  const attempts = strict ? 1 : MAX_PORT_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const candidate = port + i;
    try {
      // Whichever of `error` / `listening` fires removes the other, so a
      // failed attempt doesn't leave its `listening` callback behind for the
      // next one (which would pile up and all fire on the eventual success).
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => {
          server.removeListener("listening", onListening);
          reject(err);
        };
        const onListening = () => {
          server.removeListener("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(candidate, host);
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

/** The dev app on this thread, for `workers: 0`. */
async function startInProcessApp(
  vite: ViteDevServer,
  fns: () => ResolvedFns,
  buildDir: string,
  resolutions: Resolution[],
  project: string,
): Promise<DevApp> {
  const runner = createServerModuleRunner(vite.environments.ssr);
  const fnLoader = createFnLoader(runner, fns);

  // Install runtime context on globalThis BEFORE importing the pre-built
  // handler. The preview's `fn.server.ts` / `resolutions.server.ts` read
  // these on every request, so installing them up front keeps the first
  // request from racing against initialization.
  globalThis.__effingDevFnModuleLoader = fnLoader;
  globalThis.__effingDevResolutions = resolutions;
  globalThis.__effingDevProjectName = project;

  const close = async (): Promise<void> => {
    await runner.close();
    if (globalThis.__effingDevFnModuleLoader === fnLoader) {
      globalThis.__effingDevFnModuleLoader = undefined;
      globalThis.__effingDevResolutions = undefined;
      globalThis.__effingDevProjectName = undefined;
    }
  };

  try {
    // Pre-built RR Node server. We import dynamically so this module can be
    // typechecked / bundled before the preview build artifact exists.
    const build = await import(
      /* @vite-ignore */ pathToFileURL(path.join(buildDir, "server/index.js"))
        .href
    );
    return {
      handle: createAppListener(build),
      invalidate: (file) => invalidateFile(runner.evaluatedModules, file),
      // The loader reads the current fns on every call.
      setFns: () => {},
      prewarm() {
        // Requests for an fn still loading wait for this same import; a
        // failing fn is left for its request to report.
        for (const list of Object.values(fns())) {
          for (const { absPath } of list) {
            runner.import(absPath).catch(() => {});
          }
        }
      },
      close,
    };
  } catch (err) {
    // The caller gets no DevApp to close.
    await close();
    throw err;
  }
}

/**
 * One worker per core, leaving one for the main thread, and at most 8: each
 * worker holds its own copy of the fn modules and their canvas state. None
 * below 3 cores, where a lone worker would add the proxy hop and a copy of
 * the app without rendering anything in parallel.
 */
function defaultWorkerCount(): number {
  const workers = os.availableParallelism() - 1;
  return workers < 2 ? 0 : Math.min(workers, 8);
}

function appWorkerPath(): string {
  // Layouts:
  //  - bundled CLI:    dist/cli/index.js        → ../server/dev/app-worker.js
  //  - in-repo source: src/server/dev/host.ts   → ../../../dist/server/dev/app-worker.js
  const candidates = [
    path.resolve(__dirname, "../server/dev/app-worker.js"),
    path.resolve(__dirname, "../../../dist/server/dev/app-worker.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `Could not locate the built app worker — tried:\n  ${candidates.join("\n  ")}\n` +
      `Run \`pnpm --filter @effing/dev build\` to produce it.`,
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
  ".qoi": "image/qoi",
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
