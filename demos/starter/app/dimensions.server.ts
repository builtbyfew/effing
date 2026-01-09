/**
 * Common aspect ratios and their dimensions
 */
export function dimensionsFromAspectRatio(aspectRatio: string): {
  width: number;
  height: number;
} {
  const ratios: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
    "9:16": { width: 1080, height: 1920 },
  };
  return ratios[aspectRatio] || ratios["1:1"];
}
