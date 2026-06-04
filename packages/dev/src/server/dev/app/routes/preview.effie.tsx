import { useEffect, useReducer, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  createEffieSourceResolver,
  parseEffieValidationIssues,
  type EffieValidationIssue,
} from "@effing/effie-preview";
import {
  EffieCoverPreview,
  EffieBackgroundPreview,
  EffieSegmentPreview,
  EffieValidationErrors,
  useEffieWarmup,
} from "@effing/effie-preview/react";
import { fnModule } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";
import { getResolutions, type Resolution } from "../resolutions.server";
import { getProjectName } from "../project.server";
import { Header } from "../components/Header";
import { Select } from "../components/Select";

const RENDER_SCALES = [
  { value: 1 / 3, label: "33%" },
  { value: 2 / 3, label: "67%" },
  { value: 1, label: "100%" },
  { value: 2, label: "200%" },
] as const;

export type EffiePreviewData = {
  projectName: string;
  effieId: string;
  width: number;
  height: number;
  // The runner's return type is parameterised by sources; using `any` here
  // keeps the boundary loose without complicating the component signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effie: any;
  jsonUrl: string;
  warmupUrl: string | null;
  resolutions: Resolution[];
};

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<EffiePreviewData> {
  ensureFnRuntime();

  const effieId = params.effieId!;
  const { width, height } = parseBoundsFromUrl(request.url);
  const { previewProps, runner, propsSchema } = await fnModule(
    "effie",
    effieId,
  );
  if (propsSchema && !propsSchema.safeParse(previewProps).success) {
    throw new Error("previewProps does not adhere to the propsSchema");
  }

  const jsonUrl = `/preview/effie/${effieId}.json?w=${width}&h=${height}`;

  const effie = await runner({
    props: previewProps,
    bounds: { width, height },
  });

  let warmupUrl: string | null = null;
  if (process.env.FFS_BASE_URL && process.env.FFS_API_KEY) {
    try {
      const warmupResponse = await fetch(`${process.env.FFS_BASE_URL}/warmup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FFS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(effie),
      });
      if (warmupResponse.ok) {
        const warmupData = await warmupResponse.json();
        warmupUrl = warmupData.progressUrl;
      }
    } catch {
      // Best-effort warmup; never fail the page load on this.
    }
  }

  return {
    projectName: getProjectName(),
    effieId,
    width,
    height,
    effie,
    jsonUrl,
    warmupUrl,
    resolutions: getResolutions(),
  };
}

// ============ Render state machine ============

type RenderState =
  | { step: "idle"; error: string | null }
  | { step: "starting"; startedAt: number }
  | { step: "streaming"; startedAt: number; videoUrl: string; scale: number }
  | {
      step: "playing";
      startedAt: number;
      videoUrl: string;
      scale: number;
      playbackAt: number;
    }
  | {
      step: "done";
      startedAt: number;
      videoUrl: string;
      scale: number;
      playbackAt: number | null;
      downloadUrl: string;
    };

type RenderAction =
  | { type: "start" }
  | { type: "stream"; videoUrl: string; scale: number }
  | { type: "play" }
  | { type: "finish"; downloadUrl: string }
  | { type: "error"; error?: string }
  | { type: "reset" };

const INITIAL_RENDER_STATE: RenderState = { step: "idle", error: null };

function renderReducer(state: RenderState, action: RenderAction): RenderState {
  switch (action.type) {
    case "reset":
      return INITIAL_RENDER_STATE;
    case "start":
      return { step: "starting", startedAt: Date.now() };
    case "stream":
      if (state.step !== "starting") return state;
      return {
        step: "streaming",
        startedAt: state.startedAt,
        videoUrl: action.videoUrl,
        scale: action.scale,
      };
    case "play":
      if (state.step === "streaming")
        return { ...state, step: "playing", playbackAt: Date.now() };
      if (state.step === "done" && state.playbackAt === null)
        return { ...state, playbackAt: Date.now() };
      return state;
    case "finish":
      if (state.step === "streaming")
        return {
          ...state,
          step: "done",
          playbackAt: null,
          downloadUrl: action.downloadUrl,
        };
      if (state.step === "playing")
        return { ...state, step: "done", downloadUrl: action.downloadUrl };
      if (state.step === "done")
        return { ...state, downloadUrl: action.downloadUrl };
      return state;
    case "error":
      return { step: "idle", error: action.error ?? "Render failed" };
  }
}

// ============ Component ============

type RenderError = { error: string; issues?: EffieValidationIssue[] } | null;

export default function EffiePreviewPage() {
  const data = useLoaderData() as EffiePreviewData;
  const {
    projectName,
    effie,
    jsonUrl,
    effieId,
    width,
    height,
    warmupUrl,
    resolutions,
  } = data;

  const [render, dispatch] = useReducer(renderReducer, INITIAL_RENDER_STATE);
  const [elapsedToPlay, setElapsedToPlay] = useState<number | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [renderError, setRenderError] = useState<RenderError>(null);
  const prevDownloadUrlRef = useRef<string | null>(null);

  useEffect(() => {
    switch (render.step) {
      case "idle":
        setElapsedToPlay(null);
        return;
      case "playing":
        setElapsedToPlay((render.playbackAt - render.startedAt) / 1000);
        return;
      case "done":
        if (render.playbackAt !== null)
          setElapsedToPlay((render.playbackAt - render.startedAt) / 1000);
        return;
      case "starting":
      case "streaming": {
        const update = () =>
          setElapsedToPlay((Date.now() - render.startedAt) / 1000);
        update();
        const interval = setInterval(update, 100);
        return () => clearInterval(interval);
      }
    }
  }, [render]);

  useEffect(() => {
    dispatch({ type: "reset" });
    setRenderError(null);
    if (prevDownloadUrlRef.current) {
      URL.revokeObjectURL(prevDownloadUrlRef.current);
      prevDownloadUrlRef.current = null;
    }
  }, [effieId, width, height]);

  const warmup = useEffieWarmup(warmupUrl);
  const resolveSource = createEffieSourceResolver(effie.sources);

  const coverResolution = {
    width: Math.round((540 * width) / height),
    height: 540,
  };
  const previewResolution = {
    width: 270,
    height: Math.round((270 * height) / width),
  };
  const isReloadProhibited = isReloading || warmup.isWarming;

  const warmupElapsed =
    warmup.state.startTime && warmup.state.status !== "idle"
      ? Math.round(
          ((warmup.state.endTime ?? Date.now()) - warmup.state.startTime) /
            1000,
        )
      : 0;
  const warmupProgress =
    warmup.state.total > 0
      ? Math.round(
          ((warmup.state.cached + warmup.state.failed) / warmup.state.total) *
            100,
        )
      : 0;
  const warmupDownloadingItems = [...warmup.state.downloading.values()];
  const showProgressBar = warmup.state.status === "warming";

  const handleVideoPlay = () => dispatch({ type: "play" });

  const handleFullyBuffered = (blob: Blob) => {
    if (prevDownloadUrlRef.current) {
      URL.revokeObjectURL(prevDownloadUrlRef.current);
    }
    const downloadUrl = URL.createObjectURL(blob);
    prevDownloadUrlRef.current = downloadUrl;
    dispatch({ type: "finish", downloadUrl });
  };

  const handleRenderSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (isRendering) return;

    const form = event.currentTarget;
    const scale = parseFloat(
      (form.elements.namedItem("scale") as HTMLSelectElement).value,
    );

    setRenderError(null);
    dispatch({ type: "start" });
    if (prevDownloadUrlRef.current) {
      URL.revokeObjectURL(prevDownloadUrlRef.current);
      prevDownloadUrlRef.current = null;
    }
    setIsRendering(true);

    try {
      const res = await fetch(
        `/api/ffs/render?scale=${encodeURIComponent(scale)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(effie),
        },
      );
      if (!res.ok) {
        try {
          const body = await res.json();
          setRenderError({
            error: body.error || res.statusText,
            issues: parseEffieValidationIssues(body.issues),
          });
        } catch {
          setRenderError({ error: res.statusText });
        }
        dispatch({ type: "error" });
        return;
      }
      const { progressUrl } = await res.json();
      const eventSource = new EventSource(progressUrl);
      eventSource.addEventListener("ready", (e: MessageEvent) => {
        try {
          const { videoUrl } = JSON.parse(e.data);
          dispatch({ type: "stream", videoUrl, scale });
        } catch {
          // ignore parse errors
        }
        eventSource.close();
      });
      eventSource.addEventListener("error", (e) => {
        let error = "Render failed";
        if (e instanceof MessageEvent) {
          try {
            error = JSON.parse(e.data).message;
          } catch {
            // use default
          }
        }
        dispatch({ type: "error", error });
        eventSource.close();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Render failed";
      setRenderError({ error: message });
      dispatch({ type: "error", error: message });
    } finally {
      setIsRendering(false);
    }
  };

  const handleReloadSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (isReloadProhibited) return;
    setIsReloading(true);
    try {
      await fetch("/api/ffs/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effie),
      });
    } finally {
      setIsReloading(false);
      // Re-fetch the page so the loader runs again and warmup is restarted.
      window.location.reload();
    }
  };

  const formatSourceUrl = (url: string, maxLen = 70) => {
    if (url.length <= maxLen) return url;
    const keepStart = Math.max(20, Math.floor(maxLen * 0.6));
    const keepEnd = Math.max(10, maxLen - keepStart - 5);
    return `${url.slice(0, keepStart)}[...]${url.slice(-keepEnd)}`;
  };

  const projectSlug = projectName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const downloadName = `${projectSlug ? `${projectSlug}-` : ""}${effieId}-${width}x${height}.mp4`;

  return (
    <>
      <Header
        projectName={projectName}
        current={{
          kind: "effie",
          id: effieId,
          width,
          height,
          resolutions,
        }}
      />

      <div
        style={{
          width: "100%",
          height: 3,
          backgroundColor: "var(--color-coal-light-5)",
          opacity: showProgressBar ? 1 : 0,
          position: "sticky",
          top: "var(--header-h)",
          zIndex: 49,
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: "var(--color-salad)",
            transition: "width 0.3s ease",
            width: showProgressBar ? `${warmupProgress}%` : "0%",
          }}
        />
      </div>

      <main
        style={{
          padding: "1.25rem 2rem 4rem",
          maxWidth: 1080,
          display: "flex",
          flexDirection: "column",
          gap: "1.75rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "2rem",
            flexWrap: "wrap",
          }}
        >
          <EffieCoverPreview
            cover={effie.cover}
            resolution={coverResolution}
            video={
              render.step === "streaming" ||
              render.step === "playing" ||
              render.step === "done"
                ? render.videoUrl
                : null
            }
            onPlay={handleVideoPlay}
            onFullyBuffered={handleFullyBuffered}
            style={{
              border: "1px solid var(--color-coal-light-5)",
              backgroundColor: "var(--color-coal-light-6)",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2rem",
              flex: "1 1 320px",
              minWidth: 260,
            }}
          >
            <a
              href={jsonUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontWeight: 600, alignSelf: "flex-start" }}
            >
              JSON →
            </a>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.875rem 1rem",
                backgroundColor: "var(--color-snow)",
                border: "1px solid var(--color-coal-light-5)",
                borderRadius: 6,
                fontSize: "0.9rem",
              }}
            >
              <div>
                <span style={{ color: "var(--color-coal-light-2)" }}>
                  Resolution:{" "}
                </span>
                <strong>
                  {effie.width}×{effie.height}
                </strong>{" "}
                <span style={{ color: "var(--color-coal-light-2)" }}>
                  @ {effie.fps} fps
                </span>
              </div>
              <div>
                <span style={{ color: "var(--color-coal-light-2)" }}>
                  Segments:{" "}
                </span>
                <strong>{effie.segments.length}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-coal-light-2)" }}>
                  Sources cached:{" "}
                </span>
                <strong>
                  {warmup.state.cached}/{warmup.state.total}
                </strong>
                {warmup.state.failed > 0 && (
                  <span style={{ color: "var(--color-tomato-dark-1)" }}>
                    {" "}
                    — {warmup.state.failed} failed
                  </span>
                )}
                {warmupElapsed > 0 && (
                  <span style={{ color: "var(--color-coal-light-2)" }}>
                    {" "}
                    (in {warmupElapsed}s)
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                alignItems: "flex-start",
              }}
            >
              <form
                onSubmit={handleRenderSubmit}
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <button
                  disabled={isRendering}
                  style={{
                    padding: "0.55rem 1rem",
                    backgroundColor: "var(--color-salad)",
                    color: "var(--color-snow)",
                    border: "1px solid var(--color-salad)",
                    borderRadius: 6,
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: isRendering ? "wait" : "pointer",
                    opacity: isRendering ? 0.6 : 1,
                  }}
                >
                  {isRendering ? "Rendering..." : "Render it FFS"}
                </button>
                <span style={{ color: "var(--color-coal-light-2)" }}>at</span>
                <Select
                  name="scale"
                  defaultValue="1"
                  ariaLabel="Render scale"
                  size="md"
                >
                  {RENDER_SCALES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </form>

              <form onSubmit={handleReloadSubmit}>
                <button
                  type="submit"
                  disabled={isReloadProhibited}
                  style={{
                    padding: "0.45rem 0.85rem",
                    backgroundColor: "var(--color-snow)",
                    color: "var(--color-coal)",
                    border: "1px solid var(--color-coal-light-4)",
                    borderRadius: 6,
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: isReloadProhibited ? "wait" : "pointer",
                    opacity: isReloadProhibited ? 0.6 : 1,
                  }}
                >
                  {isReloadProhibited ? "Loading sources..." : "Reload sources"}
                </button>
              </form>
            </div>

            {renderError && (
              <EffieValidationErrors
                error={renderError.error}
                issues={renderError.issues}
              />
            )}
            {render.step === "idle" && render.error && (
              <div style={{ color: "var(--color-tomato-dark-1)" }}>
                {render.error}
              </div>
            )}

            {(render.step === "starting" || render.step === "streaming") &&
              elapsedToPlay !== null && (
                <div style={{ color: "var(--color-salad-dark-1)" }}>
                  Rendering... {elapsedToPlay.toFixed(1)}s
                </div>
              )}

            {(render.step === "playing" || render.step === "done") && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                {render.playbackAt !== null && elapsedToPlay !== null && (
                  <span style={{ color: "var(--color-salad-dark-1)" }}>
                    Started playing after {elapsedToPlay.toFixed(1)}s (at{" "}
                    {Math.round(render.scale * 100)}%)
                  </span>
                )}
                {render.step === "done" && (
                  <a
                    href={render.downloadUrl}
                    download={downloadName}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.45rem 0.85rem",
                      backgroundColor: "var(--color-snow)",
                      color: "var(--color-salad-dark-1)",
                      border: "1px solid var(--color-salad)",
                      borderRadius: 6,
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      lineHeight: "normal",
                      textDecoration: "none",
                    }}
                  >
                    Download video
                  </a>
                )}
              </div>
            )}

            {warmupDownloadingItems.length > 0 && (
              <div
                style={{
                  color: "var(--color-coal-light-2)",
                  fontSize: "0.85rem",
                  maxWidth: 520,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                Downloading:{" "}
                {warmupDownloadingItems.map((d, i) => (
                  <span key={d.url}>
                    {i > 0 ? ", " : ""}
                    <span title={d.url}>{formatSourceUrl(d.url)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <section>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
            Background
          </h2>
          <EffieBackgroundPreview
            background={effie.background}
            resolveSource={resolveSource}
            resolution={previewResolution}
          />
        </section>

        <section>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>
            Segments
          </h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {effie.segments.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (segment: any, i: number) => (
                <EffieSegmentPreview
                  key={i}
                  segment={segment}
                  index={i}
                  resolveSource={resolveSource}
                  resolution={previewResolution}
                  stacking="horizontal"
                />
              ),
            )}
          </div>
        </section>
      </main>
    </>
  );
}
