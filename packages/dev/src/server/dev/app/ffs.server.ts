/**
 * FFS is reachable whenever FFS_BASE_URL is set — `effing dev` points it at
 * the auto-spawned sidecar when the var isn't set explicitly. FFS_API_KEY is
 * only needed for servers that enforce auth (the bare sidecar doesn't).
 */
export function ffsBaseUrl(): string | undefined {
  return process.env.FFS_BASE_URL;
}

export function ffsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.FFS_API_KEY) {
    headers.Authorization = `Bearer ${process.env.FFS_API_KEY}`;
  }
  return headers;
}
