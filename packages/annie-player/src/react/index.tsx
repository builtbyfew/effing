import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AnniePlayerCore, type AnniePlayerState } from "../core";

// ============ Context ============

type AnniePlayerContextValue = {
  state: AnniePlayerState;
  actions: {
    load: () => void;
    play: () => void;
    pause: () => void;
    seek: (frameIndex: number) => void;
  };
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasDimensions: { width: number; height: number };
  isHovering: boolean;
  setIsHovering: (v: boolean) => void;
};

const AnniePlayerContext = createContext<AnniePlayerContextValue | null>(null);

function useAnniePlayerContext() {
  const ctx = useContext(AnniePlayerContext);
  if (!ctx) {
    throw new Error(
      "AnniePlayer compound components must be used within AnniePlayer.Root",
    );
  }
  return ctx;
}

// ============ Root Component ============

export type AnniePlayerRootProps = {
  src: string;
  height: number;
  defaultWidth?: number;
  autoLoad?: boolean;
  autoPlay?: boolean;
  fps?: number;
  /** Style for the root container */
  style?: React.CSSProperties;
  /** Class name for the root container */
  className?: string;
  /** Children can be React nodes or a render function for headless usage */
  children?:
    | React.ReactNode
    | ((value: AnniePlayerContextValue) => React.ReactNode);
};

function AnniePlayerRoot({
  src,
  height,
  defaultWidth,
  autoLoad = false,
  autoPlay = false,
  fps = 30,
  style,
  className,
  children,
}: AnniePlayerRootProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<AnniePlayerCore | null>(null);
  const [state, setState] = useState<AnniePlayerState>({
    status: "Ready to load animation.",
    error: null,
    isLoading: false,
    isPlaying: false,
    frameCount: 0,
    currentFrame: 0,
    dimensions: null,
  });
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: defaultWidth ?? height,
    height,
  });
  const [isHovering, setIsHovering] = useState(false);

  // Initialize the core player
  useEffect(() => {
    const player = new AnniePlayerCore({ src, fps, autoPlay });
    playerRef.current = player;

    const unsubscribeState = player.on("statechange", (newState) => {
      setState(newState);
    });

    const unsubscribeLoad = player.on("load", ({ dimensions }) => {
      setCanvasDimensions({
        width: (dimensions.width / dimensions.height) * height,
        height,
      });
    });

    return () => {
      unsubscribeState();
      unsubscribeLoad();
      player.destroy();
    };
  }, [src, fps, autoPlay, height]);

  // Attach canvas to player when ready
  useEffect(() => {
    const player = playerRef.current;
    const canvas = canvasRef.current;
    if (player && canvas) {
      player.attachCanvas(canvas);
    }
  }, [canvasDimensions]);

  // Auto-load if enabled
  useEffect(() => {
    if (autoLoad && playerRef.current) {
      playerRef.current.load();
    }
  }, [autoLoad]);

  const actions = {
    load: () => playerRef.current?.load(),
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    seek: (frameIndex: number) => playerRef.current?.seek(frameIndex),
  };

  const value: AnniePlayerContextValue = {
    state,
    actions,
    canvasRef,
    canvasDimensions,
    isHovering,
    setIsHovering,
  };

  // Render function pattern for headless usage
  if (typeof children === "function") {
    return <>{children(value)}</>;
  }

  return (
    <AnniePlayerContext.Provider value={value}>
      <div
        style={{ display: "inline-block", width: "fit-content", ...style }}
        className={className}
      >
        {children}
      </div>
    </AnniePlayerContext.Provider>
  );
}

// ============ Wrapper Component ============

type AnniePlayerWrapperProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerWrapper({
  children,
  className,
  style,
}: AnniePlayerWrapperProps) {
  const { isHovering, setIsHovering, state } = useAnniePlayerContext();
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        width: "fit-content",
        ...style,
      }}
      className={className}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-hovering={isHovering}
      data-playing={state.isPlaying}
    >
      {children}
    </div>
  );
}

// ============ Canvas Component ============

type AnniePlayerCanvasProps = {
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerCanvas({ className, style }: AnniePlayerCanvasProps) {
  const { canvasRef, canvasDimensions } = useAnniePlayerContext();
  return (
    <canvas
      ref={canvasRef}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

// ============ Controls Component ============

type AnniePlayerControlsProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerControls({
  children,
  className,
  style,
}: AnniePlayerControlsProps) {
  const { state, isHovering } = useAnniePlayerContext();
  const visible = !state.isPlaying || isHovering;
  return (
    <div
      className={className}
      style={{
        transition: "opacity 0.3s ease",
        opacity: visible ? 1 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============ Button Components ============

type AnniePlayerLoadButtonProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerLoadButton({
  children,
  className,
  style,
}: AnniePlayerLoadButtonProps) {
  const { state, actions } = useAnniePlayerContext();
  const disabled = state.isLoading;
  return (
    <button
      onClick={actions.load}
      disabled={disabled}
      data-disabled={disabled}
      className={className}
      style={style}
    >
      {children ?? (state.isLoading ? "Loading..." : "Load")}
    </button>
  );
}

type AnniePlayerPlayButtonProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerPlayButton({
  children,
  className,
  style,
}: AnniePlayerPlayButtonProps) {
  const { state, actions } = useAnniePlayerContext();
  const disabled = state.isLoading || state.isPlaying || state.frameCount === 0;
  return (
    <button
      onClick={actions.play}
      disabled={disabled}
      data-disabled={disabled}
      className={className}
      style={style}
    >
      {children ?? "Play"}
    </button>
  );
}

type AnniePlayerPauseButtonProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerPauseButton({
  children,
  className,
  style,
}: AnniePlayerPauseButtonProps) {
  const { state, actions } = useAnniePlayerContext();
  const disabled = !state.isPlaying;
  return (
    <button
      onClick={actions.pause}
      disabled={disabled}
      data-disabled={disabled}
      className={className}
      style={style}
    >
      {children ?? "Pause"}
    </button>
  );
}

// ============ Scrubber Component ============

type AnniePlayerScrubberProps = {
  className?: string;
  style?: React.CSSProperties;
  /** If true, pause playback while the user is interacting with the scrubber. */
  pauseWhileScrubbing?: boolean;
};

function AnniePlayerScrubber({
  className,
  style,
  pauseWhileScrubbing = false,
}: AnniePlayerScrubberProps) {
  const { state, actions } = useAnniePlayerContext();
  const wasPlayingRef = useRef(false);
  const disabled = state.frameCount === 0;
  const max = Math.max(0, state.frameCount - 1);

  const handlePointerDown = () => {
    if (pauseWhileScrubbing && state.isPlaying) {
      wasPlayingRef.current = true;
      actions.pause();
    }
  };

  const handlePointerUp = () => {
    if (pauseWhileScrubbing && wasPlayingRef.current) {
      wasPlayingRef.current = false;
      actions.play();
    }
  };

  return (
    <input
      type="range"
      min={0}
      max={max}
      step={1}
      value={state.currentFrame}
      disabled={disabled}
      data-disabled={disabled}
      onChange={(e) => actions.seek(Number(e.target.value))}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={className}
      style={{ width: "100%", ...style }}
    />
  );
}

// ============ Frame Counter Component ============

type AnniePlayerFrameCounterProps = {
  className?: string;
  style?: React.CSSProperties;
  /** Render the counter contents. Defaults to "current / total". */
  children?: (frame: { current: number; total: number }) => React.ReactNode;
};

function AnniePlayerFrameCounter({
  className,
  style,
  children,
}: AnniePlayerFrameCounterProps) {
  const { state } = useAnniePlayerContext();
  const current = state.currentFrame;
  const total = Math.max(0, state.frameCount - 1);
  return (
    <span
      className={className}
      style={{ fontVariantNumeric: "tabular-nums", ...style }}
    >
      {children ? children({ current, total }) : `${current} / ${total}`}
    </span>
  );
}

// ============ Status Component ============

type AnniePlayerStatusProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function AnniePlayerStatus({
  children,
  className,
  style,
}: AnniePlayerStatusProps) {
  const { state, isHovering } = useAnniePlayerContext();
  const visible = isHovering;
  return (
    <div
      className={className}
      style={{
        transition: "opacity 0.3s ease",
        opacity: visible ? 1 : 0,
        ...style,
      }}
    >
      {children ?? (
        <>
          {state.status}
          {state.error && <span> Error: {state.error}</span>}
        </>
      )}
    </div>
  );
}

// ============ Simple Component ============

export type AnniePlayerProps = {
  src: string;
  height: number;
  defaultWidth?: number;
  autoLoad?: boolean;
  autoPlay?: boolean;
  fps?: number;
  /** Style for the root container */
  style?: React.CSSProperties;
  /** Class name for the root container */
  className?: string;
};

function AnniePlayerSimple({
  src,
  height,
  defaultWidth,
  autoLoad = false,
  autoPlay = false,
  fps = 30,
  style,
  className,
}: AnniePlayerProps) {
  return (
    <AnniePlayerRoot
      src={src}
      height={height}
      defaultWidth={defaultWidth}
      autoLoad={autoLoad}
      autoPlay={autoPlay}
      fps={fps}
      style={style}
      className={className}
    >
      {({
        state,
        actions,
        canvasRef,
        canvasDimensions,
        isHovering,
        setIsHovering,
      }) => {
        const loadDisabled = state.isLoading;
        const playDisabled =
          state.isLoading || state.isPlaying || state.frameCount === 0;
        const pauseDisabled = !state.isPlaying;
        const scrubberDisabled = state.frameCount === 0;
        const overlayVisible = !state.isPlaying || isHovering;
        const totalFrames = Math.max(0, state.frameCount - 1);

        const buttonStyle = (disabled: boolean): React.CSSProperties => ({
          backgroundColor: "#222",
          color: "white",
          border: "none",
          borderRadius: 4,
          padding: "0.5rem 1rem",
          cursor: "pointer",
          margin: "0 4px",
          fontSize: "14px",
          fontWeight: 500,
          opacity: disabled ? 0.6 : 1,
        });

        return (
          <div
            style={{
              position: "relative",
              display: "inline-block",
              width: "fit-content",
            }}
            data-hovering={isHovering}
            data-playing={state.isPlaying}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div
              style={{
                position: "absolute",
                width: "90%",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 4,
                zIndex: 10,
                transition: "opacity 0.3s ease",
                opacity: overlayVisible ? 1 : 0,
              }}
            >
              <button
                onClick={actions.load}
                disabled={loadDisabled}
                data-disabled={loadDisabled}
                style={buttonStyle(loadDisabled)}
              >
                {state.isLoading ? "Loading..." : "Load"}
              </button>
              <button
                onClick={actions.play}
                disabled={playDisabled}
                data-disabled={playDisabled}
                style={buttonStyle(playDisabled)}
              >
                Play
              </button>
              <button
                onClick={actions.pause}
                disabled={pauseDisabled}
                data-disabled={pauseDisabled}
                style={buttonStyle(pauseDisabled)}
              >
                Pause
              </button>
            </div>

            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                right: 16,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                color: "white",
                borderRadius: 4,
                fontSize: 13,
                transition: "opacity 0.3s ease",
                opacity: overlayVisible ? 1 : 0,
                pointerEvents: overlayVisible ? "auto" : "none",
              }}
            >
              <input
                type="range"
                min={0}
                max={totalFrames}
                step={1}
                value={state.currentFrame}
                disabled={scrubberDisabled}
                onChange={(e) => actions.seek(Number(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: "#fff",
                  cursor: scrubberDisabled ? "not-allowed" : "pointer",
                }}
              />
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  minWidth: 64,
                  textAlign: "right",
                }}
              >
                {state.currentFrame} / {totalFrames}
              </span>
            </div>

            {state.error && (
              <div
                style={{
                  position: "absolute",
                  top: 64,
                  left: 0,
                  right: 0,
                  margin: "0 auto",
                  width: "fit-content",
                  maxWidth: "90%",
                  zIndex: 10,
                  backgroundColor: "rgba(180, 0, 0, 0.85)",
                  color: "white",
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 14,
                }}
              >
                Error: {state.error}
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={canvasDimensions.width}
              height={canvasDimensions.height}
              style={{
                display: "block",
                border: "1px solid #ccc",
                backgroundColor: "#f5f5f5",
              }}
            />
          </div>
        );
      }}
    </AnniePlayerRoot>
  );
}

/**
 * AnniePlayer - Play TAR archives of PNG/JPEG frames in the browser.
 *
 * Usage:
 * - Simple: `<AnniePlayer src={url} height={540} />`
 * - Compound: `<AnniePlayer.Root src={url} height={540}>...</AnniePlayer.Root>`
 * - Headless: `<AnniePlayer.Root src={url} height={540}>{({ state, actions }) => ...}</AnniePlayer.Root>`
 */
export const AnniePlayer = Object.assign(AnniePlayerSimple, {
  Root: AnniePlayerRoot,
  Wrapper: AnniePlayerWrapper,
  Canvas: AnniePlayerCanvas,
  Controls: AnniePlayerControls,
  LoadButton: AnniePlayerLoadButton,
  PlayButton: AnniePlayerPlayButton,
  PauseButton: AnniePlayerPauseButton,
  Scrubber: AnniePlayerScrubber,
  FrameCounter: AnniePlayerFrameCounter,
  Status: AnniePlayerStatus,
});
