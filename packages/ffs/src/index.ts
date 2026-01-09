// Re-export the renderer
export { EffieRenderer } from "./render";
export type { EffieRendererOptions } from "./render";

// Re-export FFmpeg utilities
export { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
export type { FFmpegInput } from "./ffmpeg";

// Re-export processing functions
export { processMotion } from "./motion";
export { processEffects } from "./effect";
export { processTransition } from "./transition";
