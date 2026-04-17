import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { AnniePlayer } from "@effing/annie-player/react";
import { ensureFnRuntime } from "~/fn.server";
import { fnModule, fnUrl } from "@effing/fn";
import type { Route } from "./+types/preview.annie.$annieId";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { previewProps, propsSchema } = await fnModule("annie", params.annieId);
  invariant(
    propsSchema.safeParse(previewProps).success,
    "previewProps does not adhere to the propsSchema",
  );

  const searchParams = new URL(request.url).searchParams;
  const width = parseInt(searchParams.get("w") || "1080", 10);
  const height = parseInt(searchParams.get("h") || "1080", 10);

  const url = await fnUrl(
    "annie",
    params.annieId,
    previewProps as Record<string, unknown>,
    { width, height },
  );

  return {
    annieId: params.annieId,
    annieUrl: `${url}&cache=no`,
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
      <h1 style={{ margin: 0 }}>Annie Preview: {annieId}</h1>

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
