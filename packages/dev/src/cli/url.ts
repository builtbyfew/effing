import invariant from "tiny-invariant";
import { signFnSegment } from "@effing/fn/server";
import type { FnKind } from "@effing/fn";
import { loadConfig } from "../config/load";
import { DEFAULT_DEV } from "../config/schema";
import { resolveBounds } from "./bounds";
import { applyDotenv } from "./env";
import { parseProps } from "./props";

const FN_KINDS: readonly FnKind[] = ["image", "annie", "effie"] as const;

export type UrlOptions = {
  config?: string;
  props?: string;
  width?: number;
  height?: number;
  resolution?: string;
};

export async function runUrl(
  kind: string,
  id: string,
  options: UrlOptions = {},
): Promise<void> {
  if (!FN_KINDS.includes(kind as FnKind)) {
    throw new Error(
      `Invalid kind '${kind}'. Expected one of: ${FN_KINDS.join(", ")}.`,
    );
  }
  if (!id) {
    throw new Error("Missing fn id.");
  }

  const cwd = process.cwd();
  const { config, configDir } = await loadConfig(cwd, options.config);

  // Validate the arguments before requiring env setup, so a bad --props or
  // --resolution reports its own error even when SECRET_KEY is missing.
  const props = parseProps(options.props);
  const bounds = resolveBounds(config.dev?.resolutions, options);

  // Merge .env files into process.env so BASE_URL / SECRET_KEY resolve the
  // same way they do under `effing dev`.
  applyDotenv(configDir);

  // Default BASE_URL to the dev server's configured address, mirroring the
  // default `effing dev` applies when the var is unset.
  const devHost = config.dev?.host ?? DEFAULT_DEV.host;
  const devPort = config.dev?.port ?? DEFAULT_DEV.port;
  const baseUrl = process.env.BASE_URL ?? `http://${devHost}:${devPort}`;
  const secretKey = process.env.SECRET_KEY;
  invariant(secretKey, "SECRET_KEY env var is required");

  const segment = await signFnSegment({ id, props, bounds }, secretKey);
  const url = `${baseUrl.replace(/\/$/, "")}/${kind}/${segment}`;
  console.log(url);
}
