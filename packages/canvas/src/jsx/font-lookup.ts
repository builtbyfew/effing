/**
 * Font lookup generation.
 *
 * `@napi-rs/canvas` resolves `ctx.font` through Skia's paragraph
 * `FontCollection`, which caches the typefaces it picked for each
 * (family list, weight, style) key for the lifetime of the process, and
 * registering a font does not invalidate that cache (`GlobalFonts.register`
 * never calls `FontCollection::clearCaches()`). A lookup that runs before
 * every face of a family is registered therefore pins its key to whatever
 * face was closest at the time — the fallback font if the family had no
 * faces yet, or e.g. the bold face for weight 400 if only bold existed —
 * and later registrations cannot fix it.
 *
 * To keep this package's own layout and drawing immune to that, every font
 * string it sets (see `setFont` in ./text/measure.ts) carries an extra,
 * non-existent family name that changes whenever a font is registered
 * through this package. Skia ignores the unknown family when matching, so
 * rendering is identical, but the changed family list is a new cache key,
 * so the lookup is fresh and sees every face registered so far.
 */

let generation = 0;

/**
 * Invalidate lookup keys handed out so far. Called after every registration.
 */
export function bumpFontGeneration(): void {
  generation++;
}

/**
 * The pseudo family name appended to every font string set by this package.
 */
export function fontGenerationFamily(): string {
  return `effing-font-generation-${generation}`;
}
