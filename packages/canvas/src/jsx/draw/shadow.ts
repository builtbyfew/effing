/**
 * Parsing of the CSS `box-shadow` and `text-shadow` properties.
 *
 * Their lengths arrive in px: `resolveUnits` resolves em, rem, vw and the
 * other units it knows before anything is drawn.
 */

/** One shadow of a `box-shadow` or `text-shadow` list. */
export interface Shadow {
  offsetX: number;
  offsetY: number;
  /** The blur radius, 0 or more. CSS blurs by a Gaussian of σ = blur / 2. */
  blur: number;
  /** How far the shadow's shape grows (or, negative, shrinks): box-shadow only. */
  spread: number;
  /** Whether the shadow is cast inside the padding box: box-shadow only. */
  inset: boolean;
  color: string;
}

/** How a shadow list is parsed: what its property allows. */
interface ShadowSyntax {
  /** The most lengths a shadow takes: 4 for box-shadow, 3 for text-shadow. */
  maxLengths: number;
  /** Whether `inset` is allowed (box-shadow). */
  inset: boolean;
}

const BOX_SHADOW: ShadowSyntax = { maxLengths: 4, inset: true };
const TEXT_SHADOW: ShadowSyntax = { maxLengths: 3, inset: false };

/**
 * Parse a CSS `box-shadow`: a comma-separated list of
 * `inset? && <length>{2,4} && <color>?`, in the order they are listed
 * (the first is painted on top). A shadow without a colour casts it in
 * `currentColor`. An invalid value yields no shadows, as CSS ignores it.
 */
export function parseBoxShadow(value: string, currentColor: string): Shadow[] {
  return parseShadowList(value, currentColor, BOX_SHADOW);
}

/**
 * Parse a CSS `text-shadow`: a comma-separated list of
 * `<length>{2,3} && <color>?`, in the order they are listed (the first is
 * painted on top). A shadow without a colour casts it in `currentColor`. An
 * invalid value yields no shadows, as CSS ignores it.
 */
export function parseTextShadow(value: string, currentColor: string): Shadow[] {
  return parseShadowList(value, currentColor, TEXT_SHADOW);
}

function parseShadowList(
  value: string,
  currentColor: string,
  syntax: ShadowSyntax,
): Shadow[] {
  const text = value.trim();
  if (text === "" || text.toLowerCase() === "none") return [];
  const shadows: Shadow[] = [];
  for (const item of splitTopLevel(text, ",")) {
    const shadow = parseShadow(item, currentColor, syntax);
    // One invalid shadow invalidates the whole declaration.
    if (!shadow) return [];
    shadows.push(shadow);
  }
  return shadows;
}

/** A length: a number in px, or a unitless one (as React styles allow). */
const LENGTH = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(px)?$/i;

/** A token that starts like a number: a length, or an invalid one. */
const NUMERIC = /^[+-]?\.?\d/;

function parseShadow(
  item: string,
  currentColor: string,
  syntax: ShadowSyntax,
): Shadow | null {
  const tokens = splitTopLevel(item, " ");
  const lengths: number[] = [];
  let lengthsEnded = false;
  let inset = false;
  let color: string | undefined;

  for (const token of tokens) {
    if (NUMERIC.test(token)) {
      const match = LENGTH.exec(token);
      // The lengths are one run: nothing may come between them.
      if (!match || lengthsEnded) return null;
      lengths.push(parseFloat(match[1]!));
      continue;
    }
    if (lengths.length > 0) lengthsEnded = true;
    if (token.toLowerCase() === "inset") {
      if (!syntax.inset || inset) return null;
      inset = true;
    } else {
      if (color !== undefined) return null;
      color = token;
    }
  }

  if (lengths.length < 2 || lengths.length > syntax.maxLengths) return null;
  const [offsetX, offsetY, blur = 0, spread = 0] = lengths as [
    number,
    number,
    number?,
    number?,
  ];
  if (blur < 0) return null;
  if (color === undefined || color.toLowerCase() === "currentcolor") {
    color = currentColor;
  }
  return { offsetX, offsetY, blur, spread, inset, color };
}

/**
 * Split `text` at `separator` (a comma, or a space for any white space)
 * outside parentheses, dropping empty parts: `rgb(0, 0, 0)` stays whole.
 */
export function splitTopLevel(text: string, separator: "," | " "): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    const splits =
      depth === 0 && (separator === "," ? ch === "," : /\s/.test(ch));
    if (splits) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  if (separator === ",") {
    // An empty item (`a, , b` or a trailing comma) is invalid in CSS.
    return parts.map((p) => p.trim());
  }
  return parts.filter((p) => p !== "");
}
