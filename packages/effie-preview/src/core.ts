import type { EffieSources } from "@effing/effie";

/**
 * Create a source resolver function that handles #reference lookups
 * in effie source fields.
 *
 * @param sources - The sources map from an EffieData object
 * @returns A function that resolves source references to URLs
 *
 * @example
 * ```ts
 * const resolve = createEffieSourceResolver(effieJson.sources);
 * const url = resolve(layer.source); // Handles both "#ref" and direct URLs
 * ```
 */
export function createEffieSourceResolver(sources?: EffieSources) {
  return (src: string): string => {
    if (src.startsWith("#")) {
      const key = src.slice(1);
      return sources?.[key] ?? src;
    }
    return src;
  };
}

/**
 * Type alias for a source resolver function
 */
export type EffieSourceResolver = ReturnType<typeof createEffieSourceResolver>;

/**
 * Represents a validation issue from EffieData schema validation.
 */
export type EffieValidationIssue = {
  /** Path to the field that failed validation (e.g., "segments.0.transition.sweep") */
  path: string;
  /** Human-readable error message */
  message: string;
};

/**
 * Parse an unknown value as an array of validation issues.
 *
 * @param issues - The issues value to parse (typically from errorBody.issues)
 * @returns Array of validation issues, or undefined if not a valid array
 *
 * @example
 * ```ts
 * const errorBody = await response.json();
 * const issues = parseEffieValidationIssues(errorBody.issues);
 * ```
 */
export function parseEffieValidationIssues(
  issues: unknown,
): EffieValidationIssue[] | undefined {
  if (issues && Array.isArray(issues)) {
    if (
      issues.every(
        (issue) =>
          typeof issue === "object" &&
          issue !== null &&
          "path" in issue &&
          "message" in issue,
      )
    ) {
      return issues as EffieValidationIssue[];
    } else {
      throw new Error("Invalid validation issues");
    }
  }
  return undefined;
}
