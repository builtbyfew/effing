import { z } from "zod";
import type {
  EffieHttpUrl,
  EffieDataUrl,
  EffieWebUrl,
  EffieFileUrl,
  EffieSources,
  EffieData,
  EffieBackground,
  EffieAudio,
  EffieSegment,
  EffieLayer,
  EffieTransition,
  EffieEffect,
  EffieMotion,
} from "./types";

// URL schemas using z.custom to enforce exact type matching:

export const effieHttpUrlSchema = z.custom<EffieHttpUrl>(
  (val): val is EffieHttpUrl =>
    typeof val === "string" &&
    (val.startsWith("http://") || val.startsWith("https://")),
  { message: "Must be an HTTP or HTTPS URL" },
);

export const effieDataUrlSchema = z.custom<EffieDataUrl>(
  (val): val is EffieDataUrl =>
    typeof val === "string" && val.startsWith("data:"),
  { message: "Must be a data URL" },
);

export const effieWebUrlSchema = z.custom<EffieWebUrl>(
  (val): val is EffieWebUrl =>
    typeof val === "string" &&
    (val.startsWith("http://") ||
      val.startsWith("https://") ||
      val.startsWith("data:")),
  { message: "Must be an HTTP, HTTPS, or data URL" },
) satisfies z.ZodType<EffieWebUrl>;

export const effieFileUrlSchema = z.custom<EffieFileUrl>(
  (val): val is EffieFileUrl =>
    typeof val === "string" && val.startsWith("file:"),
  { message: "Must be a file URL" },
) satisfies z.ZodType<EffieFileUrl>;

// Source reference schema (matches #sourceName pattern)
const sourceRefSchema = z.custom<`#${string}`>(
  (val): val is `#${string}` => typeof val === "string" && val.startsWith("#"),
  { message: "Source reference must start with #" },
);

// Color schema for color backgrounds. Accepts the color forms ffmpeg's color
// source understands — named colors, #RRGGBB[AA], and 0xRRGGBB[AA], each with
// an optional @alpha suffix — and nothing else. Renderers interpolate this
// value into an ffmpeg lavfi filtergraph, so filtergraph metacharacters
// (":", "[", "]", ";", ",", "=", quotes, backslashes, whitespace) must never
// pass validation.
const colorPattern =
  /^(#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})|0x[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|[a-zA-Z]+)(@(0(\.\d+)?|1(\.0+)?))?$/;

const colorSchema = z
  .string()
  .regex(
    colorPattern,
    "Invalid color: expected a named color, #RRGGBB[AA], or 0xRRGGBB[AA], optionally with an @alpha suffix",
  );

// Transition schema
export const effieTransitionSchema = z.union([
  // Fade with easing
  z.strictObject({
    type: z.literal("fade"),
    duration: z.number(),
    easing: z.enum(["linear", "ease-in", "ease-out"]).optional(),
  }),
  // Fade through color
  z.strictObject({
    type: z.literal("fade"),
    duration: z.number(),
    through: z.enum(["black", "white", "grays"]),
  }),
  // Barn door wipes
  z.strictObject({
    type: z.literal("barn"),
    duration: z.number(),
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    mode: z.enum(["open", "close"]).optional(),
  }),
  // Circle wipes
  z.strictObject({
    type: z.literal("circle"),
    duration: z.number(),
    mode: z.enum(["open", "close", "crop"]).optional(),
  }),
  // Directional transitions (wipe, slide, smooth, slice)
  z.strictObject({
    type: z.enum(["wipe", "slide", "smooth", "slice"]),
    duration: z.number(),
    direction: z.enum(["left", "right", "up", "down"]).optional(),
  }),
  // Zoom
  z.strictObject({
    type: z.literal("zoom"),
    duration: z.number(),
  }),
  // Standalone transitions
  z.strictObject({
    type: z.enum(["dissolve", "pixelize", "radial"]),
    duration: z.number(),
  }),
]) satisfies z.ZodType<EffieTransition>;

// Effect schema
export const effieEffectSchema = z.union([
  z.strictObject({
    type: z.literal("fade-in"),
    duration: z.number(),
    start: z.number(),
  }),
  z.strictObject({
    type: z.literal("fade-out"),
    duration: z.number(),
    start: z.number(),
  }),
  z.strictObject({
    type: z.literal("saturate-in"),
    duration: z.number(),
    start: z.number(),
  }),
  z.strictObject({
    type: z.literal("saturate-out"),
    duration: z.number(),
    start: z.number(),
  }),
  z.strictObject({
    type: z.literal("scroll"),
    duration: z.number(),
    direction: z.enum(["left", "right", "up", "down"]),
    distance: z.number(),
  }),
]) satisfies z.ZodType<EffieEffect>;

// Motion schema
export const effieMotionSchema = z.union([
  z.strictObject({
    type: z.literal("bounce"),
    start: z.number().optional(),
    duration: z.number().optional(),
    amplitude: z.number().optional(),
  }),
  z.strictObject({
    type: z.literal("shake"),
    start: z.number().optional(),
    duration: z.number().optional(),
    intensity: z.number().optional(),
    frequency: z.number().optional(),
  }),
  z.strictObject({
    type: z.literal("slide"),
    start: z.number().optional(),
    duration: z.number().optional(),
    direction: z.enum(["left", "right", "up", "down"]),
    distance: z.number().optional(),
    reverse: z.boolean().optional(),
    easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).optional(),
  }),
]) satisfies z.ZodType<EffieMotion>;

// Schema factories for generic types.
// Note: These return inferred Zod types. Type checking happens on the concrete
// exported schemas below via explicit type annotations (which use `satisfies`
// semantics - assignment to a typed variable fails if types don't match).

export function createEffieSourcesSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  return z.record(z.string(), urlSchema);
}

export function createEffieSourceSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  return z.union([urlSchema, sourceRefSchema]);
}

export function createEffieBackgroundSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  const sourceSchema = createEffieSourceSchema(urlSchema);

  return z.union([
    z.strictObject({
      type: z.literal("image"),
      source: sourceSchema,
    }),
    z.strictObject({
      type: z.literal("video"),
      source: sourceSchema,
      seek: z.number().optional(),
    }),
    z.strictObject({
      type: z.literal("color"),
      color: colorSchema,
    }),
  ]);
}

export function createEffieAudioSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  const sourceSchema = createEffieSourceSchema(urlSchema);

  return z.strictObject({
    source: sourceSchema,
    volume: z.number().min(0).max(1).optional(),
    fadeIn: z.number().optional(),
    fadeOut: z.number().optional(),
    seek: z.number().optional(),
  });
}

export function createEffieLayerSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  const sourceSchema = createEffieSourceSchema(urlSchema);

  return z.strictObject({
    type: z.enum(["image", "animation"]),
    source: sourceSchema,
    delay: z.number().optional(),
    from: z.number().optional(),
    until: z.number().optional(),
    effects: z.array(effieEffectSchema).optional(),
    motion: effieMotionSchema.optional(),
  });
}

export function createEffieSegmentSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  const layerSchema = createEffieLayerSchema(urlSchema);
  const backgroundSchema = createEffieBackgroundSchema(urlSchema);
  const audioSchema = createEffieAudioSchema(urlSchema);

  return z.strictObject({
    duration: z.number(),
    layers: z.array(layerSchema),
    background: backgroundSchema.optional(),
    audio: audioSchema.optional(),
    transition: effieTransitionSchema.optional(),
  });
}

// Type for parsed data shape (matches Zod output, used for source ref collection)
type ParsedEffieData = {
  background: { source?: string } | { type: "color" };
  audio?: { source: string };
  segments: Array<{
    background?: { source?: string } | { type: "color" };
    audio?: { source: string };
    layers: Array<{ source: string }>;
  }>;
};

// Helper to collect all source references from parsed data
function collectSourceRefs(data: ParsedEffieData): string[] {
  const refs: string[] = [];

  const addIfRef = (source: string) => {
    if (source.startsWith("#")) {
      refs.push(source.slice(1));
    }
  };

  // Top-level background and audio
  if ("source" in data.background && data.background.source) {
    addIfRef(data.background.source);
  }
  if (data.audio) {
    addIfRef(data.audio.source);
  }

  // Segments
  for (const segment of data.segments) {
    if (
      segment.background &&
      "source" in segment.background &&
      segment.background.source
    ) {
      addIfRef(segment.background.source);
    }
    if (segment.audio) {
      addIfRef(segment.audio.source);
    }
    for (const layer of segment.layers) {
      addIfRef(layer.source);
    }
  }

  return refs;
}

export function createEffieDataSchema<U extends string>(
  urlSchema: z.ZodType<U>,
) {
  const sourcesSchema = createEffieSourcesSchema(urlSchema);
  const segmentSchema = createEffieSegmentSchema(urlSchema);
  const backgroundSchema = createEffieBackgroundSchema(urlSchema);
  const audioSchema = createEffieAudioSchema(urlSchema);

  return z
    .strictObject({
      width: z.number(),
      height: z.number(),
      fps: z.number(),
      cover: effieWebUrlSchema, // cover must always be a web URL
      sources: sourcesSchema.optional(),
      background: backgroundSchema,
      audio: audioSchema.optional(),
      segments: z.array(segmentSchema),
    })
    .superRefine((data, ctx) => {
      // Validate source references exist
      const definedSources = new Set(Object.keys(data.sources ?? {}));
      // Type assertion: Zod has validated the structure, but its inferred types
      // add spurious `| undefined` to required fields
      const referencedSources = collectSourceRefs(data as ParsedEffieData);

      for (const ref of referencedSources) {
        if (!definedSources.has(ref)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Source reference "#${ref}" not found in sources`,
          });
        }
      }

      // Validate transition durations: both current and previous segment must be
      // at least as long as the transition duration
      for (let i = 1; i < data.segments.length; i++) {
        const segment = data.segments[i];
        const prevSegment = data.segments[i - 1];

        if (segment.transition) {
          const transitionDuration = segment.transition.duration;

          if (segment.duration < transitionDuration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Segment ${i} duration (${segment.duration}s) must be at least as long as its transition duration (${transitionDuration}s)`,
              path: ["segments", i, "duration"],
            });
          }

          if (prevSegment.duration < transitionDuration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Segment ${i - 1} duration (${prevSegment.duration}s) must be at least as long as the following transition duration (${transitionDuration}s)`,
              path: ["segments", i - 1, "duration"],
            });
          }
        }
      }
    });
}

// Default schemas for web URLs (most common use case):

export const effieSourcesSchema: z.ZodType<EffieSources<EffieWebUrl>> =
  createEffieSourcesSchema(effieWebUrlSchema);

export const effieSourceSchema = createEffieSourceSchema(effieWebUrlSchema);

export const effieBackgroundSchema: z.ZodType<
  EffieBackground<EffieSources<EffieWebUrl>, EffieWebUrl>
> = createEffieBackgroundSchema(effieWebUrlSchema);

export const effieAudioSchema: z.ZodType<
  EffieAudio<EffieSources<EffieWebUrl>, EffieWebUrl>
> = createEffieAudioSchema(effieWebUrlSchema);

export const effieLayerSchema: z.ZodType<
  EffieLayer<EffieSources<EffieWebUrl>, EffieWebUrl>
> = createEffieLayerSchema(effieWebUrlSchema);

export const effieSegmentSchema: z.ZodType<
  EffieSegment<EffieSources<EffieWebUrl>, EffieWebUrl>
> = createEffieSegmentSchema(effieWebUrlSchema);

export const effieDataSchema: z.ZodType<
  EffieData<EffieSources<EffieWebUrl>, EffieWebUrl>
> = createEffieDataSchema(effieWebUrlSchema);

// Schema for data that allows file URLs (for trusted operations)
type WebOrFileUrl = EffieWebUrl | EffieFileUrl;
const webOrFileUrlSchema = z.custom<WebOrFileUrl>(
  (val): val is WebOrFileUrl =>
    typeof val === "string" &&
    (val.startsWith("http://") ||
      val.startsWith("https://") ||
      val.startsWith("data:") ||
      val.startsWith("file:")),
  { message: "Must be an HTTP, HTTPS, data, or file URL" },
);

export const effieDataWithFilesSchema: z.ZodType<
  EffieData<EffieSources<WebOrFileUrl>, WebOrFileUrl>
> = createEffieDataSchema(webOrFileUrlSchema);
