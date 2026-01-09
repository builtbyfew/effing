/**
 * Generate an array of step values for an animation
 * @param count Number of steps
 * @returns Array of step values from 0 to (count-1)/count
 */
export function steps(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i / count);
}
