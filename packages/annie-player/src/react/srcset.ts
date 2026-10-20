/** One image candidate from a `srcset`: its URL and its descriptor(s). */
export type SrcsetCandidate = { url: string; descriptors: string };

const isSpace = (c: string) =>
  c === " " || c === "\t" || c === "\n" || c === "\f" || c === "\r";

/**
 * Split a `srcset` into its candidates, following the HTML parsing rules:
 * a URL runs up to the next whitespace (so commas inside it, as in a data
 * URL, are kept, and trailing ones end the candidate), and its descriptors
 * run up to the next comma outside parentheses.
 *
 * @returns The candidates, or null if one has no URL
 */
export function parseSrcset(srcset: string): SrcsetCandidate[] | null {
  const candidates: SrcsetCandidate[] = [];
  let i = 0;
  for (;;) {
    while (i < srcset.length && (isSpace(srcset[i]) || srcset[i] === ",")) i++;
    if (i >= srcset.length) return candidates;

    let start = i;
    while (i < srcset.length && !isSpace(srcset[i])) i++;
    let url = srcset.slice(start, i);
    let descriptors = "";
    if (url.endsWith(",")) {
      url = url.replace(/,+$/, "");
    } else {
      start = i;
      let depth = 0;
      for (; i < srcset.length; i++) {
        const c = srcset[i];
        if (c === "(") depth++;
        else if (c === ")") depth = Math.max(0, depth - 1);
        else if (c === "," && depth === 0) break;
      }
      descriptors = srcset.slice(start, i).trim();
      i++; // the comma
    }
    if (!url) return null;
    candidates.push({ url, descriptors });
  }
}

/** Join candidates back into a `srcset`. */
export function serializeSrcset(candidates: SrcsetCandidate[]): string {
  return candidates
    .map(({ url, descriptors }) =>
      descriptors ? `${url} ${descriptors}` : url,
    )
    .join(", ");
}

/** Whether two URLs, each possibly relative to `base`, are the same. */
export function sameUrl(a: string, b: string, base: string): boolean {
  try {
    return new URL(a, base).href === new URL(b, base).href;
  } catch {
    return false;
  }
}

/**
 * Replace the URL of the candidate that resolves to `url`, keeping its
 * descriptors, so the browser gives the replacement the same density.
 *
 * @returns The new `srcset`, or null if it can't be parsed or no candidate
 *   is `url`
 */
export function replaceSrcsetCandidate(
  srcset: string,
  url: string,
  replacement: string,
  base: string,
): string | null {
  const candidates = parseSrcset(srcset);
  const index =
    candidates?.findIndex((candidate) => sameUrl(candidate.url, url, base)) ??
    -1;
  if (!candidates || index === -1) return null;
  candidates[index] = { ...candidates[index], url: replacement };
  return serializeSrcset(candidates);
}
