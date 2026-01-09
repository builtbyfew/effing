import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { AnniePlayer } from "@effing/annie-player/react";
import { getAnnie } from "~/annies";
import { annieUrl } from "~/urls.server";
import type { Route } from "./+types/pan.$annieId";

const styles = {
  pageContainer: {
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
  },
  headerTitle: {
    margin: 0,
  },
  preBlock: {
    padding: "0.75rem 1rem",
    backgroundColor: "#fafafa",
    border: "1px solid #ddd",
    borderRadius: 4,
    overflow: "auto",
    fontSize: "0.75rem",
    margin: 0,
  },
} as const satisfies Record<string, React.CSSProperties>;

export async function loader({ params, request }: Route.LoaderArgs) {
  const { previewProps, propsSchema } = await getAnnie(params.annieId);
  invariant(
    propsSchema.safeParse(previewProps).success,
    "previewProps does not adhere to the propsSchema",
  );

  const searchParams = new URL(request.url).searchParams;
  const width = parseInt(searchParams.get("w") || "1080", 10);
  const height = parseInt(searchParams.get("h") || "1080", 10);

  const url = await annieUrl({
    annieId: params.annieId,
    props: previewProps as Record<string, unknown>,
    width,
    height,
  });

  return {
    annieId: params.annieId,
    annieUrl: url,
    height,
  };
}

export default function AnniePreviewPage() {
  const { annieId, annieUrl, height } = useLoaderData<typeof loader>();

  return (
    <div style={styles.pageContainer}>
      <h1 style={styles.headerTitle}>Annie Preview: {annieId}</h1>

      <AnniePlayer
        src={annieUrl}
        height={Math.min(540, height)}
        autoLoad={true}
        autoPlay={true}
        fps={30}
      />

      <div>
        <h3>Direct URL</h3>
        <pre style={styles.preBlock}>{annieUrl}</pre>
      </div>

      <div>
        <h3>Convert to Animated PNG</h3>
        <pre style={styles.preBlock}>
          {`curl '${annieUrl}' \\
  | tar -xO | ffmpeg -f image2pipe -framerate 30 -i - -plays 0 -c:v apng -f apng ${annieId}.png`}
        </pre>
      </div>
    </div>
  );
}
