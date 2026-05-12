// Production server entry. Bundled into the user's project at `effing
// build` time. The virtual import below is resolved by an esbuild plugin
// in `cli/build.ts` that emits a tiny generated module wiring up the
// user's `*.fn.tsx` files into the `modulesByKind` map. Everything else
// here is fixed boilerplate and stays typechecked under tsc.

import { createServer } from "node:http";
import {
  initFnRuntime,
  type FnKind,
  type FnModule,
  type FnModuleLoader,
} from "@effing/fn";
import { createFlatUrlBuilder, createFnHttpListener } from "@effing/fn/server";
import invariant from "tiny-invariant";
import { modulesByKind } from "virtual:effing/fns";

const baseUrl = process.env.BASE_URL;
const secretKey = process.env.SECRET_KEY;
invariant(baseUrl, "BASE_URL env var is required");
invariant(secretKey, "SECRET_KEY env var is required");

const moduleLoader: FnModuleLoader = {
  async loadModule<K extends FnKind>(kind: K, id: string) {
    const collection = modulesByKind[kind];
    const mod = collection?.[id];
    if (!mod) throw new Error(`no ${kind} found for id '${id}'`);
    return mod as FnModule<K>;
  },
  listModules: (kind) => Object.keys(modulesByKind[kind] ?? {}),
  hasModule: (kind, id) => Boolean(modulesByKind[kind]?.[id]),
};

initFnRuntime({
  moduleLoader,
  urlBuilder: createFlatUrlBuilder({ baseUrl, secretKey }),
});

const listener = createFnHttpListener({ moduleLoader, secretKey });
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

createServer(listener).listen(port, host, () => {
  console.log(`Effing fn server listening on http://${host}:${port}`);
});
