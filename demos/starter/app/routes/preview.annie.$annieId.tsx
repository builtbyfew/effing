import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { AnniePlayer } from "@effing/annie-player/react";
import { ensureFnRuntime } from "~/fn.server";
import { RESOLUTIONS } from "~/resolutions";
import { parseBoundsFromUrl } from "~/urls.server";
import { fnModule, fnUrl } from "@effing/fn";
import type { Route } from "./+types/preview.annie.$annieId";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { previewProps, propsSchema } = await fnModule("annie", params.annieId);
  invariant(
    propsSchema.safeParse(previewProps).success,
    "previewProps does not adhere to the propsSchema",
  );

  const { width, height } = parseBoundsFromUrl(request.url);

  const url = await fnUrl(
    "annie",
    params.annieId,
    previewProps as Record<string, unknown>,
    { width, height },
  );

  return {
    annieId: params.annieId,
    annieUrl: url,
    width,
    height,
  };
}

export default function AnniePreviewPage() {
  const { annieId, annieUrl, width, height } = useLoaderData<typeof loader>();

  const scaledDimensions = {
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
        height={scaledDimensions.height}
        defaultWidth={scaledDimensions.width}
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
