const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type ResolvedBaseUrl = {
  baseUrl: string;
  /** Set when `baseUrl` came from the default rather than the environment. */
  defaulted: boolean;
  /** Set when a local BASE_URL points at a different port than the server. */
  warning?: string;
};

/**
 * Resolve the BASE_URL the dev server should sign fn URLs against.
 *
 * When unset, default to the dev server's own address — running on a
 * non-default port then needs no `.env` edit. When set to a local URL whose
 * port differs from the one we actually bound, surface a warning: that's
 * almost always a stale `.env` from before the port moved. Non-local
 * hostnames are left alone — tunnels and proxies legitimately differ.
 */
export function resolveBaseUrl(
  existing: string | undefined,
  host: string,
  port: number,
): ResolvedBaseUrl {
  if (!existing) {
    return { baseUrl: `http://${host}:${port}`, defaulted: true };
  }

  let url: URL;
  try {
    url = new URL(existing);
  } catch {
    // Unparseable — leave it for the fn runtime to surface on first use.
    return { baseUrl: existing, defaulted: false };
  }

  const urlPort = url.port || (url.protocol === "https:" ? "443" : "80");
  const isLocal = LOCAL_HOSTNAMES.has(url.hostname) || url.hostname === host;
  if (isLocal && urlPort !== String(port)) {
    return {
      baseUrl: existing,
      defaulted: false,
      warning:
        `BASE_URL (${existing}) does not match the dev server port ${port} — ` +
        `signed fn URLs will point at the wrong server. ` +
        `Update BASE_URL or unset it to use the dev server's own address.`,
    };
  }
  return { baseUrl: existing, defaulted: false };
}
