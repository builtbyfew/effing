import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { AnniePlayer } from "@effing/annie-player/react";
import { fnModule, fnUrl } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";
import { RESOLUTIONS } from "../resolutions";

export type AnniePreviewData = {
  annieId: string;
  annieUrl: string;
  width: number;
  height: number;
};

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<AnniePreviewData> {
  ensureFnRuntime();
  const annieId = params.annieId!;
  const { previewProps, propsSchema } = await fnModule("annie", annieId);
  if (!propsSchema.safeParse(previewProps).success) {
    throw new Error("previewProps does not adhere to the propsSchema");
  }

  const { width, height } = parseBoundsFromUrl(request.url);
  const url = await fnUrl(
    "annie",
    annieId,
    previewProps as Record<string, unknown>,
    { width, height },
  );

  return { annieId, annieUrl: url, width, height };
}

export default function AnniePreviewPage() {
  const { annieId, annieUrl, width, height } =
    useLoaderData() as AnniePreviewData;
  const scaled = {
    width: Math.round((540 * width) / height),
    height: 540,
  };

  return (
    <div
      style={{
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      <div>
        <h1 style={{ margin: 0 }}>Annie Preview: {annieId}</h1>
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
                  <a
                    href={`/preview/annie/${annieId}?w=${r.width}&h=${r.height}`}
                  >
                    {r.width}x{r.height} ({r.label})
                  </a>
                )}
              </span>
            );
          })}
        </p>
      </div>

      <AnniePlayer
        src={annieUrl}
        height={scaled.height}
        defaultWidth={scaled.width}
        autoLoad={true}
        autoPlay={true}
        fps={30}
      />

      <div>
        <h3>Direct URL</h3>
        <pre
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fafafa",
            border: "1px solid #ddd",
            borderRadius: 4,
            overflow: "auto",
            fontSize: "0.75rem",
            margin: 0,
          }}
        >
          {annieUrl}
        </pre>
      </div>

      <div>
        <h3>Convert to Animated PNG</h3>
        <pre
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fafafa",
            border: "1px solid #ddd",
            borderRadius: 4,
            overflow: "auto",
            fontSize: "0.75rem",
            margin: 0,
          }}
        >
          {`curl '${annieUrl}' \\
  | tar -xO | ffmpeg -f image2pipe -framerate 30 -i - -plays 0 -c:v apng -f apng ${annieId}.png`}
        </pre>
      </div>
    </div>
  );
}
