import { initFnRuntime, type FnModuleLoader } from "@effing/fn";
import { createFlatUrlBuilder } from "@effing/fn/server";
import invariant from "tiny-invariant";

function getModuleLoader(): FnModuleLoader {
  const loader = globalThis.__effingDevFnModuleLoader;
  invariant(loader, "fn module loader not installed on globalThis");
  return loader;
}

let initialized = false;

export function ensureFnRuntime(): void {
  if (initialized) return;
  const baseUrl = process.env.BASE_URL;
  const secretKey = process.env.SECRET_KEY;
  invariant(baseUrl, "BASE_URL env var is required");
  invariant(secretKey, "SECRET_KEY env var is required");
  initFnRuntime({
    moduleLoader: getModuleLoader(),
    urlBuilder: createFlatUrlBuilder({ baseUrl, secretKey }),
  });
  initialized = true;
}
