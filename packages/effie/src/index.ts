// Types
export type {
  EffieWebUrl,
  EffieFileUrl,
  EffieHttpUrl,
  EffieDataUrl,
  EffieSources,
  EffieSource,
  EffieData,
  EffieBackground,
  EffieAudio,
  EffieSegment,
  EffieLayer,
  EffieTransition,
  EffieEffect,
  EffieMotion,
} from "./types";

// Type helpers
export {
  effieWebUrl,
  effieFileUrl,
  effieData,
  effieSegment,
  effieLayer,
  effieBackground,
} from "./types";

// Partitioning helpers
export { effieDataForSegment, effieDataForJoin } from "./partition";

// Extraction helpers
export type {
  ExtractSourcesOptions,
  EffieSourceType,
  EffieSourceWithType,
} from "./extract";
export { extractEffieSources, extractEffieSourcesWithTypes } from "./extract";

// Zod schemas (optional - requires zod peer dependency)
export {
  // URL schemas
  effieHttpUrlSchema,
  effieDataUrlSchema,
  effieWebUrlSchema,
  effieFileUrlSchema,
  // Schema factories
  createEffieSourcesSchema,
  createEffieSourceSchema,
  createEffieBackgroundSchema,
  createEffieAudioSchema,
  createEffieLayerSchema,
  createEffieSegmentSchema,
  createEffieDataSchema,
  // Default schemas (web URLs only)
  effieSourcesSchema,
  effieSourceSchema,
  effieBackgroundSchema,
  effieAudioSchema,
  effieLayerSchema,
  effieSegmentSchema,
  effieDataSchema,
  // Standalone schemas
  effieTransitionSchema,
  effieEffectSchema,
  effieMotionSchema,
  // Schema with file URL support
  effieDataWithFilesSchema,
} from "./schema";
