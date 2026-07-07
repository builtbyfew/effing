import type { EffieData, EffieSources, EffieWebUrl } from "./types";

/**
 * Returns a minimal EffieData containing only what's needed to render a single segment.
 * Can be used for distributed rendering where each segment is rendered independently.
 */
export function effieDataForSegment(
  effieData: EffieData<EffieSources>,
  segmentIndex: number,
): EffieData<EffieSources> {
  if (segmentIndex < 0 || segmentIndex >= effieData.segments.length) {
    throw new Error(
      `Invalid segment index: ${segmentIndex}. Must be between 0 and ${
        effieData.segments.length - 1
      }`,
    );
  }

  const segment = effieData.segments[segmentIndex];

  // Collect all source references used by this segment
  const usedSourceRefs = new Set<string>();

  // Check global background source
  if (effieData.background.type !== "color") {
    const bgSource = effieData.background.source;
    if (typeof bgSource === "string" && bgSource.startsWith("#")) {
      usedSourceRefs.add(bgSource.slice(1));
    }
  }

  // Check segment background source
  if (segment.background && segment.background.type !== "color") {
    const segBgSource = segment.background.source;
    if (typeof segBgSource === "string" && segBgSource.startsWith("#")) {
      usedSourceRefs.add(segBgSource.slice(1));
    }
  }

  // Check layer sources
  for (const layer of segment.layers) {
    if (typeof layer.source === "string" && layer.source.startsWith("#")) {
      usedSourceRefs.add(layer.source.slice(1));
    }
  }

  // Check segment audio source
  if (segment.audio) {
    const audioSource = segment.audio.source;
    if (typeof audioSource === "string" && audioSource.startsWith("#")) {
      usedSourceRefs.add(audioSource.slice(1));
    }
  }

  // Build minimal sources object with only referenced sources
  const minimalSources: EffieSources = {};
  if (effieData.sources) {
    for (const ref of usedSourceRefs) {
      if (ref in effieData.sources) {
        minimalSources[ref] = effieData.sources[ref];
      }
    }
  }

  // Build background with accumulated seek time for video backgrounds.
  // This must mirror the monolithic renderer's timeline accumulation: an
  // xfade transition overlaps the tail of the previous segment, so each
  // prior segment advances the background by its duration minus the
  // duration of the transition into the *next* segment (floored at 0.001s,
  // like the renderer). Summing full durations instead would seek the
  // shared background further than the monolithic render at the same
  // segment boundary, making the background visibly jump on transitions.
  const background =
    effieData.background.type === "video"
      ? {
          ...effieData.background,
          seek:
            (effieData.background.seek ?? 0) +
            effieData.segments.slice(0, segmentIndex).reduce((sum, seg, i) => {
              const transitionDuration =
                effieData.segments[i + 1]?.transition?.duration ?? 0;
              return sum + Math.max(0.001, seg.duration - transitionDuration);
            }, 0),
        }
      : effieData.background;

  // Create minimal effie data with just this segment
  return {
    width: effieData.width,
    height: effieData.height,
    fps: effieData.fps,
    cover: effieData.cover,
    background,
    segments: [segment], // Only include the target segment (with its background if any)
    ...(Object.keys(minimalSources).length > 0
      ? { sources: minimalSources }
      : {}),
    // Note: global audio is excluded - it's handled in the join phase
  };
}

/**
 * Returns EffieData for joining pre-rendered segments into a final video.
 * Each segment uses its corresponding pre-rendered video as both background and audio source.
 *
 * @param effieData - The original EffieData with segment metadata (durations, transitions)
 * @param segmentSourceUrls - URLs to pre-rendered segment videos (one per segment)
 */
export function effieDataForJoin<
  U extends string = EffieWebUrl,
  V extends string = EffieWebUrl,
>(
  effieData: EffieData<EffieSources<U>, U>,
  segmentSourceUrls: V[],
): EffieData<EffieSources<U | V>, U | V> {
  if (segmentSourceUrls.length !== effieData.segments.length) {
    throw new Error(
      `Expected ${effieData.segments.length} segment sources, got ${segmentSourceUrls.length}`,
    );
  }

  // Build sources object with segment references and global audio refs
  const sources: EffieSources<U | V> = {};

  // Add segment sources as named references (enables caching for background+audio reuse)
  // Using __segment_ prefix to avoid collisions with user-defined sources
  for (let i = 0; i < segmentSourceUrls.length; i++) {
    sources[`__segment_${i}`] = segmentSourceUrls[i];
  }

  // Include any source refs used by global audio
  if (effieData.audio) {
    const audioSource = effieData.audio.source;
    if (typeof audioSource === "string" && audioSource.startsWith("#")) {
      const ref = audioSource.slice(1);
      if (effieData.sources && ref in effieData.sources) {
        sources[ref] = effieData.sources[ref];
      }
    }
  }

  return {
    width: effieData.width,
    height: effieData.height,
    fps: effieData.fps,
    cover: effieData.cover,
    background: { type: "color", color: "black" }, // Not used - each segment has its own background
    segments: effieData.segments.map((seg, i) => ({
      duration: seg.duration,
      layers: [], // Layers not needed - video is pre-rendered
      transition: seg.transition,
      background: { type: "video" as const, source: `#__segment_${i}` },
      audio: { source: `#__segment_${i}` }, // FFmpeg extracts audio from mp4
    })),
    audio: effieData.audio, // Global audio is mixed during render
    sources,
  };
}
