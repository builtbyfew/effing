import { effieWebUrl, type EffieWebUrl } from "@effing/effie";
import type { Bounds, FnKind, FnUrlBuilder } from "../types";
import { signFnSegment } from "./segments";

export type CreateUrlBuilderOptions = {
  secretKey: string;
  /**
   * Compose the final URL from a kind and a signed segment. Self-host typically
   * returns `${baseUrl}/${kind}/${segment}`; the cloud fn server uses a
   * tenant/project-prefixed shape.
   */
  buildUrl: (kind: FnKind, segment: string) => string;
};

export function createUrlBuilder(
  options: CreateUrlBuilderOptions,
): FnUrlBuilder {
  const { secretKey, buildUrl } = options;
  return {
    async buildUrl(
      kind: FnKind,
      id: string,
      props: Record<string, unknown>,
      bounds: Bounds,
    ): Promise<EffieWebUrl> {
      const segment = await signFnSegment({ id, props, bounds }, secretKey);
      return effieWebUrl(buildUrl(kind, segment));
    },
  };
}

export type CreateFlatUrlBuilderOptions = {
  /** Base URL the fn server is reachable at — e.g. `http://localhost:3839` or `https://example.com`. */
  baseUrl: string;
  secretKey: string;
};

/** Convenience: builds `${baseUrl}/${kind}/${segment}` URLs. */
export function createFlatUrlBuilder(
  options: CreateFlatUrlBuilderOptions,
): FnUrlBuilder {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  return createUrlBuilder({
    secretKey: options.secretKey,
    buildUrl: (kind, segment) => `${baseUrl}/${kind}/${segment}`,
  });
}
