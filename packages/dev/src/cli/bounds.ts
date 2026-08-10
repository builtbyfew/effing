import type { Resolution } from "../config/schema";
import { DEFAULT_RESOLUTIONS } from "../config/schema";

export type BoundsOptions = {
  width?: number;
  height?: number;
  resolution?: string;
};

/**
 * Resolve render bounds from CLI options against the project's
 * `dev.resolutions` presets. `--resolution <label>` picks a preset by its
 * label and refuses to combine with explicit `--width`/`--height` (no silent
 * precedence); without it, explicit dimensions win and the first preset
 * fills in whatever's missing.
 */
export function resolveBounds(
  resolutions: Resolution[] | undefined,
  options: BoundsOptions,
): { width: number; height: number } {
  const presets = resolutions?.length ? resolutions : DEFAULT_RESOLUTIONS;
  if (options.resolution !== undefined) {
    if (options.width !== undefined || options.height !== undefined) {
      throw new Error("--resolution cannot be combined with --width/--height.");
    }
    const preset = presets.find((r) => r.label === options.resolution);
    if (!preset) {
      throw new Error(
        `Unknown resolution '${options.resolution}'. Available: ${presets
          .map((r) => r.label)
          .join(", ")}.`,
      );
    }
    return { width: preset.width, height: preset.height };
  }
  const fallback = presets[0];
  return {
    width: options.width ?? fallback.width,
    height: options.height ?? fallback.height,
  };
}
