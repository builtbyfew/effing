/**
 * Stable, sync ID for a URL for use as a Map key.
 * (We don't want to use the full URL as a Map key because it can be huge.)
 */
export function hashUrlToId(url: string): string {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned + compact string
  return (hash >>> 0).toString(36);
}
