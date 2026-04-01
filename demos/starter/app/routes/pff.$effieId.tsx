import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { useEffect, useReducer, useRef, useState } from "react";
import invariant from "tiny-invariant";
import { serialize } from "@effing/serde";
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
import { ensureFnRuntime } from "~/fn.server";
import { fnModule } from "@effing/fn";
import type { Route } from "./+types/pff.$effieId";

// ============ Constants ============

const RESOLUTIONS = [
  { width: 1080, height: 1080, label: "1:1" },
  { width: 1080, height: 1350, label: "4:5" },
  { width: 1080, height: 1920, label: "9:16" },
] as const;

const RENDER_SCALES = [
  { value: 1 / 3, label: "33%" },
  { value: 2 / 3, label: "67%" },
  { value: 1, label: "100%" },
  { value: 2, label: "200%" },
] as const;

// ============ Types ============

type ActionResult =
  | {
      intent: "render";
      success: true;
      progressUrl: string;
      renderScale: number;
    }
  | {
      intent: "render";
      success: false;
      error: string;
      issues?: EffieValidationIssue[];
    }
  | { intent: "reload"; success: true; purged: number; total: number }
  | { intent: "reload"; success: false; error: string };

type RenderState =
  | { step: "idle"; error: string | null }
  | { step: "starting"; startedAt: number }
  | {
      step: "streaming";
      startedAt: number;
      videoUrl: string;
      scale: number;
    }
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
  | { type: "error"; error?: string };

const INITIAL_RENDER_STATE: RenderState = { step: "idle", error: null };

function renderReducer(state: RenderState, action: RenderAction): RenderState {
  switch (action.type) {
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

// ============ Loader ============

export async function loader({ request, params }: Route.LoaderArgs) {
  ensureFnRuntime();
  const requestUrl = new URL(request.url);
  const width = parseInt(requestUrl.searchParams.get("w") || "1080", 10);
  const height = parseInt(requestUrl.searchParams.get("h") || "1080", 10);

  const {
    previewProps,
    runner: generateEffie,
    propsSchema,
  } = await fnModule("effie", params.effieId);

  if (propsSchema) {
    invariant(
      propsSchema.safeParse(previewProps).success,
      "previewProps does not adhere to the propsSchema",
    );
  }

  const urlSegment = await serialize(
    { effieId: params.effieId, ...previewProps },
    process.env.SECRET_KEY!,
  );

  const effie = await generateEffie({
    props: previewProps,
    dimensions: { width, height },
  });

  // Create warmup job if FFS is configured
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
      // Warmup is best-effort, don't fail the page load
    }
  }

  return {
    effieId: params.effieId,
    width,
    height,
    effie,
    jsonUrl: `/ff/${urlSegment}?w=${width}&h=${height}`,
    warmupUrl,
  };
}

export function shouldRevalidate({
  defaultShouldRevalidate,
  formData,
}: ShouldRevalidateFunctionArgs) {
  // Only skip revalidation for render submissions - we want to preserve the
  // video result. For reload, allow revalidation so the loader runs again and
  // starts a fresh warmup.
  if (formData?.get("intent") === "render") {
    return false;
  }
  return defaultShouldRevalidate;
}

// ============ Action ============

async function handleReload(effieJson: string): Promise<ActionResult> {
  if (!process.env.FFS_BASE_URL || !process.env.FFS_API_KEY) {
    return { intent: "reload", success: false, error: "FFS not configured" };
  }

  try {
    const purgeResponse = await fetch(`${process.env.FFS_BASE_URL}/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FFS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: effieJson,
    });

    if (!purgeResponse.ok) {
      return {
        intent: "reload",
        success: false,
        error: "Failed to purge cache",
      };
    }

    const purgeData = await purgeResponse.json();
    return {
      intent: "reload",
      success: true,
      purged: purgeData.purged,
      total: purgeData.total,
    };
  } catch (err) {
    return {
      intent: "reload",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function handleRender(
  effieJson: string,
  scale: number,
): Promise<ActionResult> {
  if (!process.env.FFS_BASE_URL || !process.env.FFS_API_KEY) {
    return { intent: "render", success: false, error: "FFS not configured" };
  }

  try {
    const createResponse = await fetch(
      `${process.env.FFS_BASE_URL}/render?scale=${scale}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FFS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: effieJson,
      },
    );

    if (!createResponse.ok) {
      try {
        const errorBody = await createResponse.json();
        return {
          intent: "render",
          success: false,
          error: errorBody.error || createResponse.statusText,
          issues: parseEffieValidationIssues(errorBody.issues),
        };
      } catch {
        return {
          intent: "render",
          success: false,
          error: createResponse.statusText,
        };
      }
    }

    const { progressUrl } = await createResponse.json();
    return { intent: "render", success: true, renderScale: scale, progressUrl };
  } catch (err) {
    return {
      intent: "render",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function action({
  request,
}: Route.ActionArgs): Promise<ActionResult> {
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();
  const effieJson = formData.get("effie")?.toString();

  if (!effieJson) {
    return { intent: "render", success: false, error: "Missing effie data" };
  }

  if (intent === "reload") {
    return handleReload(effieJson);
  }

  const scale = parseFloat(formData.get("scale")?.toString() || "1");
  return handleRender(effieJson, scale);
}

// ============ Component ============

export default function EffiePreviewPage() {
  const { effie, jsonUrl, effieId, width, height, warmupUrl } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [render, dispatch] = useReducer(renderReducer, INITIAL_RENDER_STATE);
  const [elapsedToPlay, setElapsedToPlay] = useState<number | null>(null);
  const prevDownloadUrlRef = useRef<string | null>(null);

  // Update elapsed time while rendering is in progress
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

  // Connect to SSE progress when render action completes
  useEffect(() => {
    if (!actionData || actionData.intent !== "render" || !actionData.success)
      return;

    const { progressUrl, renderScale } = actionData;
    const eventSource = new EventSource(progressUrl);

    eventSource.addEventListener("ready", (e) => {
      try {
        const { videoUrl } = JSON.parse(e.data);
        dispatch({ type: "stream", videoUrl, scale: renderScale });
      } catch {
        // Ignore parse errors
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

    return () => {
      eventSource.close();
    };
  }, [actionData]);

  const warmup = useEffieWarmup(warmupUrl);
  const resolveSource = createEffieSourceResolver(effie.sources);

  // Compute scaled resolution for preview (540px height for cover)
  const coverResolution = {
    width: Math.round((540 * width) / height),
    height: 540,
  };
  // Scaled resolution for background/segment previews (270px width)
  const previewResolution = {
    width: 270,
    height: Math.round((270 * height) / width),
  };

  const isLoading = navigation.state === "loading";
  const isRendering =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "render";
  const isReloading =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "reload";
  const isReloadProhibited = isLoading || isReloading || warmup.isWarming;

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

  // Generic progress bar state (currently driven by warmup)
  const progress = warmupProgress;
  const showProgressBar = warmup.state.status === "warming";

  const handleVideoPlay = () => {
    dispatch({ type: "play" });
  };

  const handleRenderSubmit = () => {
    dispatch({ type: "start" });
    if (prevDownloadUrlRef.current) {
      URL.revokeObjectURL(prevDownloadUrlRef.current);
      prevDownloadUrlRef.current = null;
    }
  };

  const handleFullyBuffered = (blob: Blob) => {
    if (prevDownloadUrlRef.current) {
      URL.revokeObjectURL(prevDownloadUrlRef.current);
    }
    const downloadUrl = URL.createObjectURL(blob);
    prevDownloadUrlRef.current = downloadUrl;
    dispatch({ type: "finish", downloadUrl });
  };

  const formatSourceUrl = (url: string, maxLen = 70) => {
    if (url.length <= maxLen) return url;
    const keepStart = Math.max(20, Math.floor(maxLen * 0.6));
    const keepEnd = Math.max(10, maxLen - keepStart - 5);
    return `${url.slice(0, keepStart)}[...]${url.slice(-keepEnd)}`;
  };

  return (
    <div>
      {/* Progress Bar */}
      <div
        style={{
          width: "100%",
          height: 6,
          backgroundColor: "#E5E7EB",
          opacity: showProgressBar ? 1 : 0,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: "#4CAE4C",
            transition: "width 0.3s ease",
            width: showProgressBar ? `${progress}%` : "0%",
          }}
        />
      </div>

      <div
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {/* Header */}
        <div>
          <h1 style={{ margin: 0 }}>Effie Preview: {effieId}</h1>
          <p style={{ color: "#666" }}>
            Resolution:{" "}
            {RESOLUTIONS.map((r, i) => {
              const isCurrent = r.width === width && r.height === height;
              return (
                <span key={`${r.width}x${r.height}`}>
                  {i > 0 && " | "}
                  {isCurrent ? (
                    <strong>
                      {r.width}x{r.height} ({r.label})
                    </strong>
                  ) : (
                    <a href={`/pff/${effieId}?w=${r.width}&h=${r.height}`}>
                      {r.width}x{r.height} ({r.label})
                    </a>
                  )}
                </span>
              );
            })}
          </p>
        </div>

        {/* Cover and Controls */}
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
              border: "1px solid black",
              backgroundColor: "#eee",
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
            <a href={jsonUrl} target="_blank" rel="noreferrer">
              JSON →
            </a>

            {/* Info */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                {effie.width}x{effie.height} @ {effie.fps} fps
              </div>
              <div>{effie.segments.length} segments</div>
              <div>
                <span>
                  {warmup.state.cached}/{warmup.state.total} sources cached
                </span>
                {warmup.state.failed > 0 && (
                  <span style={{ color: "#E44444" }}>
                    {" "}
                    - {warmup.state.failed} failed
                  </span>
                )}
                {warmupElapsed > 0 && <span> (in {warmupElapsed}s)</span>}
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                alignItems: "flex-start",
              }}
            >
              <Form
                method="post"
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
                onSubmit={handleRenderSubmit}
              >
                <input type="hidden" name="intent" value="render" />
                <input
                  type="hidden"
                  name="effie"
                  value={JSON.stringify(effie)}
                />
                <button
                  disabled={isLoading || isRendering}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#222",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: isRendering ? "wait" : "pointer",
                    opacity: isLoading || isRendering ? 0.6 : 1,
                  }}
                >
                  {isRendering ? "Rendering..." : "Render it FFS"}
                </button>
                <span>at</span>
                <select
                  name="scale"
                  defaultValue={RENDER_SCALES[0].value}
                  style={{
                    padding: "0.4rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  {RENDER_SCALES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Form>

              <Form method="post">
                <input
                  type="hidden"
                  name="effie"
                  value={JSON.stringify(effie)}
                />
                <button
                  type="submit"
                  name="intent"
                  value="reload"
                  disabled={isReloadProhibited}
                  style={{
                    padding: "0.4rem 0.75rem",
                    backgroundColor: "#fff",
                    color: "#222",
                    border: "1px solid black",
                    borderRadius: 4,
                    fontSize: "14px",
                    cursor: isReloadProhibited ? "wait" : "pointer",
                    opacity: isReloadProhibited ? 0.6 : 1,
                  }}
                >
                  {isReloadProhibited ? "Loading sources..." : "Reload sources"}
                </button>
              </Form>
            </div>

            {/* Render Error */}
            {actionData?.intent === "render" && !actionData.success && (
              <EffieValidationErrors
                error={actionData.error}
                issues={actionData.issues}
              />
            )}
            {render.step === "idle" && render.error && (
              <div style={{ color: "#E44444" }}>{render.error}</div>
            )}

            {/* Render Progress */}
            {(render.step === "starting" || render.step === "streaming") &&
              elapsedToPlay !== null && (
                <div style={{ color: "#4CAE4C" }}>
                  Rendering... {elapsedToPlay.toFixed(1)}s
                </div>
              )}

            {/* Render Success */}
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
                  <span style={{ color: "#4CAE4C" }}>
                    Started playing after {elapsedToPlay.toFixed(1)}s (at{" "}
                    {Math.round(render.scale * 100)}%)
                  </span>
                )}
                {render.step === "done" && (
                  <a
                    href={render.downloadUrl}
                    download={`${effieId}-${width}x${height}.mp4`}
                    style={{
                      padding: "0.4rem 0.75rem",
                      backgroundColor: "#fff",
                      color: "#4CAE4C",
                      border: "1px solid #4CAE4C",
                      borderRadius: 4,
                      fontSize: "14px",
                      textDecoration: "none",
                    }}
                  >
                    Download video
                  </a>
                )}
              </div>
            )}

            {/* Downloading Status */}
            {warmupDownloadingItems.length > 0 && (
              <div
                style={{
                  color: "#666",
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

        {/* Background */}
        <div>
          <h2>Background</h2>
          <EffieBackgroundPreview
            background={effie.background}
            resolveSource={resolveSource}
            resolution={previewResolution}
          />
        </div>

        {/* Segments */}
        <div>
          <h2>Segments</h2>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {effie.segments.map((segment, i) => (
              <EffieSegmentPreview
                key={i}
                segment={segment}
                index={i}
                resolveSource={resolveSource}
                resolution={previewResolution}
                stacking="horizontal"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
