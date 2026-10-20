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
      // As in the spec's tokenizer, a "(" opens parentheses and the first
      // ")" closes them, however many "(" came before: there's no nesting.
      start = i;
      let inParens = false;
      for (; i < srcset.length; i++) {
        const c = srcset[i];
        if (c === "(") inParens = true;
        else if (c === ")") inParens = false;
        else if (c === "," && !inParens) break;
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

/**
 * Whether two URLs, each possibly relative to `base`, are the same image.
 * Fragments are ignored: fetching ignores them, and Chrome's `currentSrc`
 * can carry a stale one from its memory cache.
 */
export function sameUrl(a: string, b: string, base: string): boolean {
  try {
    const urlA = new URL(a, base);
    const urlB = new URL(b, base);
    urlA.hash = "";
    urlB.hash = "";
    return urlA.href === urlB.href;
  } catch {
    return false;
  }
}

/**
 * Replace the URL of every candidate that resolves to `url`, keeping their
 * descriptors, so the browser gives the replacement the same density. All
 * of them are the same image, and one left behind could be selected again.
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
  if (!candidates) return null;
  let replaced = false;
  const rewritten = candidates.map((candidate) => {
    if (!sameUrl(candidate.url, url, base)) return candidate;
    replaced = true;
    return { ...candidate, url: replacement };
  });
  return replaced ? serializeSrcset(rewritten) : null;
}
