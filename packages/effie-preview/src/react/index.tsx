import { useEffect, useRef, useState } from "react";
import type {
  EffieBackground,
  EffieSegment,
  EffieLayer,
  EffieSources,
  EffieWebUrl,
} from "@effing/effie";
import { AnniePlayer } from "@effing/annie-player/react";
import type { EffieSourceResolver, EffieValidationIssue } from "../core";
import { connectEffieWarmupStream, type EffieWarmupState } from "../warmup";
import { hashUrlToId } from "../utils";
export { useVideoStream } from "./use-video-stream";
export type { UseVideoStreamResult } from "./use-video-stream";
import { useVideoStream } from "./use-video-stream";

// ============ Video Preview ============

export type EffieVideoPreviewProps = {
  /** Video URL to stream via MSE */
  url: string;
  /** Optional poster image URL */
  poster?: string;
  /** Callback when video starts playing */
  onPlay?: () => void;
  /** Callback when video is fully buffered (entire video downloaded) */
  onFullyBuffered?: (blob: Blob) => void;
  /** Class name for the video element */
  className?: string;
  /** Style for the video element */
  style?: React.CSSProperties;
};

/**
 * Streams a video via MSE (with blob fallback) so the entire file is buffered
 * in memory. This avoids follow-up network requests on seek, which is critical
 * for one-time-consumption URLs like FFS render endpoints.
 */
export function EffieVideoPreview({
  url,
  poster,
  onPlay,
  onFullyBuffered,
  className,
  style,
}: EffieVideoPreviewProps) {
  const { videoRef, isFullyBuffered, blobRef } = useVideoStream(url);
  const firedRef = useRef(false);

  // Reset fired flag when URL changes
  const lastUrlRef = useRef(url);
  if (url !== lastUrlRef.current) {
    lastUrlRef.current = url;
    firedRef.current = false;
  }

  useEffect(() => {
    if (
      isFullyBuffered &&
      onFullyBuffered &&
      !firedRef.current &&
      blobRef.current
    ) {
      firedRef.current = true;
      onFullyBuffered(blobRef.current);
    }
  }, [isFullyBuffered, onFullyBuffered]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      crossOrigin="anonymous"
      className={className}
      style={style}
      controls
      autoPlay
      onPlay={onPlay}
    />
  );
}

// ============ Cover Preview ============

export type EffieCoverPreviewProps = {
  /** Cover image URL */
  cover: EffieWebUrl;
  /** Resolution for preview */
  resolution: { width: number; height: number };
  /** Optional video URL to show instead of cover image (e.g., after rendering) */
  video?: string | null;
  /** Callback when video starts playing */
  onPlay?: () => void;
  /** Callback when video is fully buffered (entire video downloaded) */
  onFullyBuffered?: (blob: Blob) => void;
  /** Class name for the img/video element */
  className?: string;
  /** Style for the img/video element */
  style?: React.CSSProperties;
};

/**
 * Displays the effie cover image, or a video if provided.
 * When a video URL is given, renders an {@link EffieVideoPreview} with the
 * cover as poster image. Otherwise renders a static `<img>`.
 */
export function EffieCoverPreview({
  cover,
  resolution,
  video,
  onPlay,
  onFullyBuffered,
  className,
  style,
}: EffieCoverPreviewProps) {
  if (video) {
    return (
      <EffieVideoPreview
        url={video}
        poster={cover}
        onPlay={onPlay}
        onFullyBuffered={onFullyBuffered}
        className={className}
        style={{ ...style, height: resolution.height }}
      />
    );
  }

  return (
    <img
      src={cover}
      alt="Cover"
      className={className}
      style={{ ...style, height: resolution.height }}
    />
  );
}

// ============ Background Preview - Compound Components ============

type EffieBackgroundPreviewRootProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

function EffieBackgroundPreviewRoot({
  className,
  style,
  children,
}: EffieBackgroundPreviewRootProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

type EffieBackgroundPreviewMediaProps = {
  /** Background configuration from effie JSON */
  background: EffieBackground<EffieSources>;
  /** Function to resolve source references */
  resolveSource: EffieSourceResolver;
  /** Class name for the media element */
  className?: string;
  /** Style for the media element */
  style?: React.CSSProperties;
};

function EffieBackgroundPreviewMedia({
  background,
  resolveSource,
  className,
  style,
}: EffieBackgroundPreviewMediaProps) {
  if (background.type === "color") {
    return (
      <div
        className={className}
        style={{ ...style, backgroundColor: background.color }}
      />
    );
  }

  if (background.type === "image") {
    return (
      <img
        src={resolveSource(background.source)}
        alt="Background"
        className={className}
        style={{ objectFit: "cover", ...style }}
      />
    );
  }

  if (background.type === "video") {
    return (
      <video
        src={resolveSource(background.source)}
        className={className}
        style={{ objectFit: "cover", ...style }}
        autoPlay
        loop
        muted
      />
    );
  }

  return null;
}

type EffieBackgroundPreviewInfoProps = {
  /** Background configuration from effie JSON */
  background: EffieBackground<EffieSources>;
  /** Class name for the info section */
  className?: string;
  /** Style for the info section */
  style?: React.CSSProperties;
};

function EffieBackgroundPreviewInfo({
  background,
  className,
  style,
}: EffieBackgroundPreviewInfoProps) {
  return (
    <div className={className} style={style}>
      <strong>Type:</strong> {background.type}
      {background.type === "color" && (
        <div>
          <strong>Color:</strong> {background.color}
        </div>
      )}
    </div>
  );
}

// Simple pre-composed Background Preview

export type EffieBackgroundPreviewProps = {
  /** Background configuration from effie JSON */
  background: EffieBackground<EffieSources>;
  /** Function to resolve source references */
  resolveSource: EffieSourceResolver;
  /** Resolution for preview */
  resolution: { width: number; height: number };
  /** Class name for the container */
  className?: string;
  /** Style for the container */
  style?: React.CSSProperties;
};

function EffieBackgroundPreviewSimple({
  background,
  resolveSource,
  resolution,
  className,
  style,
}: EffieBackgroundPreviewProps) {
  return (
    <EffieBackgroundPreviewRoot
      className={className}
      style={{
        display: "flex",
        gap: "1rem",
        ...style,
      }}
    >
      <EffieBackgroundPreviewMedia
        background={background}
        resolveSource={resolveSource}
        style={{
          border: "1px solid #ddd",
          width: resolution.width,
          height: resolution.height,
        }}
      />
      <EffieBackgroundPreviewInfo
        background={background}
        style={{
          fontSize: "0.85rem",
          color: "#666",
        }}
      />
    </EffieBackgroundPreviewRoot>
  );
}

/**
 * Displays a preview of the effie background (color, image, or video).
 *
 * Usage:
 * - Simple: `<EffieBackgroundPreview background={...} resolveSource={...} />`
 * - Compound: `<EffieBackgroundPreview.Root>...</EffieBackgroundPreview.Root>`
 */
export const EffieBackgroundPreview = Object.assign(
  EffieBackgroundPreviewSimple,
  {
    Root: EffieBackgroundPreviewRoot,
    Media: EffieBackgroundPreviewMedia,
    Info: EffieBackgroundPreviewInfo,
  },
);

// ============ Layer Preview - Compound Components ============

type EffieLayerPreviewRootProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

function EffieLayerPreviewRoot({
  className,
  style,
  children,
}: EffieLayerPreviewRootProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

type EffieLayerPreviewMediaProps = {
  /** Layer configuration from effie JSON */
  layer: EffieLayer<EffieSources>;
  /** Layer index (0-based) for alt text */
  index: number;
  /** Function to resolve source references */
  resolveSource: EffieSourceResolver;
  /** Resolution for preview */
  resolution: { width: number; height: number };
  /** Class name for the media element */
  className?: string;
  /** Style for the media element */
  style?: React.CSSProperties;
};

function EffieLayerPreviewMedia({
  layer,
  index,
  resolveSource,
  resolution,
  className,
  style,
}: EffieLayerPreviewMediaProps) {
  if (layer.type === "animation") {
    return (
      <AnniePlayer
        src={resolveSource(layer.source)}
        height={resolution.height}
        defaultWidth={resolution.width}
        autoLoad={false}
        autoPlay={true}
        className={className}
        style={style}
      />
    );
  }

  return (
    <img
      src={resolveSource(layer.source)}
      alt={`Layer ${index + 1}`}
      className={className}
      style={{ ...style, height: resolution.height }}
    />
  );
}

type EffieLayerPreviewInfoProps = {
  /** Layer configuration from effie JSON */
  layer: EffieLayer<EffieSources>;
  /** Layer index (0-based) */
  index: number;
  /** Class name for the info section */
  className?: string;
  /** Style for the info section */
  style?: React.CSSProperties;
};

function EffieLayerPreviewInfo({
  layer,
  index,
  className,
  style,
}: EffieLayerPreviewInfoProps) {
  return (
    <div className={className} style={style}>
      <strong>Layer {index + 1}</strong> ({layer.type})
      {layer.delay !== undefined && layer.delay > 0 && (
        <div>Delay: {layer.delay}s</div>
      )}
      {layer.from !== undefined && <div>From: {layer.from}s</div>}
      {layer.until !== undefined && <div>Until: {layer.until}s</div>}
      {layer.effects && layer.effects.length > 0 && (
        <EffieJsonBlock label="Effects" data={layer.effects} />
      )}
      {layer.motion && <EffieJsonBlock label="Motion" data={layer.motion} />}
    </div>
  );
}

// Simple pre-composed Layer Preview

export type EffieLayerPreviewProps = {
  /** Layer configuration from effie JSON */
  layer: EffieLayer<EffieSources>;
  /** Layer index (0-based) */
  index: number;
  /** Function to resolve source references */
  resolveSource: EffieSourceResolver;
  /** Resolution for preview */
  resolution: { width: number; height: number };
  /** How to stack info relative to media: "horizontal" (default, info beside) or "vertical" (info below) */
  stacking?: "vertical" | "horizontal";
  /** Class name for the container */
  className?: string;
  /** Style for the container */
  style?: React.CSSProperties;
};

function EffieLayerPreviewSimple({
  layer,
  index,
  resolveSource,
  resolution,
  stacking = "horizontal",
  className,
  style,
}: EffieLayerPreviewProps) {
  return (
    <EffieLayerPreviewRoot
      className={className}
      style={{
        display: "flex",
        flexDirection: stacking === "vertical" ? "column" : "row",
        gap: "1rem",
        ...style,
      }}
    >
      <EffieLayerPreviewMedia
        layer={layer}
        index={index}
        resolveSource={resolveSource}
        resolution={resolution}
        style={{
          border: "1px solid #ddd",
        }}
      />
      <EffieLayerPreviewInfo
        layer={layer}
        index={index}
        style={{
          fontSize: "0.85rem",
          color: "#666",
        }}
      />
    </EffieLayerPreviewRoot>
  );
}

/**
 * Displays a preview of a single layer, including its metadata.
 * Uses AnniePlayer for animation layers.
 *
 * Usage:
 * - Simple: `<EffieLayerPreview layer={...} index={...} resolveSource={...} />`
 * - Compound: `<EffieLayerPreview.Root>...</EffieLayerPreview.Root>`
 */
export const EffieLayerPreview = Object.assign(EffieLayerPreviewSimple, {
  Root: EffieLayerPreviewRoot,
  Media: EffieLayerPreviewMedia,
  Info: EffieLayerPreviewInfo,
});

// ============ Segment Preview - Compound Components ============

type EffieSegmentPreviewRootProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

function EffieSegmentPreviewRoot({
  className,
  style,
  children,
}: EffieSegmentPreviewRootProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

type EffieSegmentPreviewHeaderProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

function EffieSegmentPreviewHeader({
  className,
  style,
  children,
}: EffieSegmentPreviewHeaderProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

type EffieSegmentPreviewLayersProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

function EffieSegmentPreviewLayers({
  className,
  style,
  children,
}: EffieSegmentPreviewLayersProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

// Simple pre-composed Segment Preview

export type EffieSegmentPreviewProps = {
  /** Segment configuration from effie JSON */
  segment: EffieSegment<EffieSources>;
  /** Segment index (0-based) */
  index: number;
  /** Function to resolve source references */
  resolveSource: EffieSourceResolver;
  /** Resolution for preview */
  resolution: { width: number; height: number };
  /** How to stack layers: "vertical" (default) or "horizontal" */
  stacking?: "vertical" | "horizontal";
  /** Class name for the container */
  className?: string;
  /** Style for the container */
  style?: React.CSSProperties;
};

function EffieSegmentPreviewSimple({
  segment,
  index,
  resolveSource,
  resolution,
  stacking = "vertical",
  className,
  style,
}: EffieSegmentPreviewProps) {
  const layerStacking = stacking === "horizontal" ? "vertical" : "horizontal";

  return (
    <EffieSegmentPreviewRoot
      className={className}
      style={{
        padding: "1rem",
        border: "1px solid #ddd",
        borderRadius: 8,
        backgroundColor: "#fafafa",
        ...style,
      }}
    >
      <EffieSegmentPreviewHeader
        style={{
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        <strong>Segment {index + 1}</strong>
        {" — "}
        {segment.duration}s
        {segment.transition && (
          <span>
            {" "}
            (transition: {segment.transition.type},{" "}
            {segment.transition.duration}
            s)
          </span>
        )}
      </EffieSegmentPreviewHeader>

      <EffieSegmentPreviewLayers
        style={{
          display: "flex",
          flexDirection: stacking === "horizontal" ? "row" : "column",
          flexWrap: stacking === "horizontal" ? "wrap" : undefined,
          gap: "1rem",
        }}
      >
        {segment.layers.map((layer, j) => (
          <EffieLayerPreviewSimple
            key={j}
            layer={layer}
            index={j}
            resolveSource={resolveSource}
            resolution={resolution}
            stacking={layerStacking}
          />
        ))}
      </EffieSegmentPreviewLayers>
    </EffieSegmentPreviewRoot>
  );
}

/**
 * Displays a preview of a segment with all its layers.
 *
 * Usage:
 * - Simple: `<EffieSegmentPreview segment={...} index={...} resolveSource={...} />`
 * - Compound: `<EffieSegmentPreview.Root>...</EffieSegmentPreview.Root>`
 */
export const EffieSegmentPreview = Object.assign(EffieSegmentPreviewSimple, {
  Root: EffieSegmentPreviewRoot,
  Header: EffieSegmentPreviewHeader,
  Layers: EffieSegmentPreviewLayers,
});

// ============ Validation Errors ============

export type EffieValidationErrorsProps = {
  /** Error message (e.g., "Invalid effie data") */
  error: string;
  /** List of validation issues */
  issues?: EffieValidationIssue[];
  /** Class name for the container */
  className?: string;
  /** Style for the container */
  style?: React.CSSProperties;
};

/**
 * Displays validation errors with detailed issue breakdown.
 * Simple component with built-in inline styles.
 */
export function EffieValidationErrors({
  error,
  issues,
  className,
  style,
}: EffieValidationErrorsProps) {
  return (
    <div
      className={className}
      style={{
        padding: "1rem",
        backgroundColor: "#fff5f5",
        border: "1px solid #ffcccc",
        borderRadius: 8,
        ...style,
      }}
    >
      <div
        style={{
          color: "red",
          fontWeight: 600,
        }}
      >
        Error: {error}
      </div>
      {issues && issues.length > 0 && (
        <ul
          style={{
            margin: "0.5rem 0",
            paddingLeft: "1.5rem",
          }}
        >
          {issues.map((issue, i) => (
            <li
              key={i}
              style={{
                marginBottom: "0.25rem",
              }}
            >
              <code>{issue.path || "(root)"}</code>: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============ Internal Components ============

type EffieJsonBlockProps = {
  label: string;
  data: unknown;
};

function EffieJsonBlock({ label, data }: EffieJsonBlockProps) {
  return (
    <div>
      <div>{label}:</div>
      <pre
        style={{
          margin: "4px 0",
          fontSize: "0.75rem",
          backgroundColor: "#f0f0f0",
          padding: "4px 8px",
          borderRadius: 4,
          overflow: "auto",
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ============ Warmup Hook ============

export type UseEffieWarmupResult = {
  state: EffieWarmupState;
  isReady: boolean;
  isWarming: boolean;
  hasError: boolean;
};

/**
 * Hook to connect to a warmup SSE stream and track progress.
 *
 * @param streamUrl - The full SSE stream URL returned by the FFS server (null if FFS not configured)
 */
export function useEffieWarmup(streamUrl: string | null): UseEffieWarmupResult {
  const [state, setState] = useState<EffieWarmupState>({
    status: "idle",
    total: 0,
    cached: 0,
    failed: 0,
    skipped: 0,
    downloading: new Map(),
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!streamUrl) {
      return;
    }

    setState({
      status: "connecting",
      total: 0,
      cached: 0,
      failed: 0,
      skipped: 0,
      downloading: new Map(),
      startTime: Date.now(),
    });

    // streamUrl is now a full URL returned by the FFS server
    cleanupRef.current = connectEffieWarmupStream(streamUrl, (event) => {
      setState((prev) => {
        switch (event.type) {
          case "start":
            return { ...prev, status: "warming", total: event.data.total };

          case "progress": {
            const newDownloading = new Map(prev.downloading);
            newDownloading.delete(hashUrlToId(event.data.url));
            return {
              ...prev,
              cached: event.data.cached,
              failed: event.data.failed,
              skipped: event.data.skipped,
              downloading: newDownloading,
            };
          }

          case "downloading": {
            const newDownloading = new Map(prev.downloading);
            newDownloading.set(hashUrlToId(event.data.url), {
              url: event.data.url,
              bytesReceived: event.data.bytesReceived,
            });
            return { ...prev, downloading: newDownloading };
          }

          case "keepalive":
          case "summary":
            return {
              ...prev,
              cached: event.data.cached,
              failed: event.data.failed,
              skipped: event.data.skipped,
            };

          case "complete":
            return { ...prev, status: "ready", endTime: Date.now() };

          case "error":
            return { ...prev, status: "error", error: event.data.message };

          default:
            return prev;
        }
      });
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [streamUrl]);

  return {
    state,
    isReady: state.status === "ready",
    isWarming: state.status === "warming" || state.status === "connecting",
    hasError: state.status === "error",
  };
}
