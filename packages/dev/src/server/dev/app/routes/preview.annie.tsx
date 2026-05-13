import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { AnniePlayer } from "@effing/annie-player/react";
import { fnModule, fnUrl } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";
import { getResolutions, type Resolution } from "../resolutions.server";
import { getProjectName } from "../project.server";
import { Header } from "../components/Header";
import { CodeBlock } from "../components/Preview";

export type AnniePreviewData = {
  projectName: string;
  annieId: string;
  annieUrl: string;
  width: number;
  height: number;
  resolutions: Resolution[];
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

  return {
    projectName: getProjectName(),
    annieId,
    annieUrl: url,
    width,
    height,
    resolutions: getResolutions(),
  };
}

export default function AnniePreviewPage() {
  const { projectName, annieId, annieUrl, width, height, resolutions } =
    useLoaderData() as AnniePreviewData;
  const scaled = {
    width: Math.round((540 * width) / height),
    height: 540,
  };

  return (
    <>
      <Header
        projectName={projectName}
        current={{
          kind: "annie",
          id: annieId,
          width,
          height,
          resolutions,
        }}
      />
      <main
        style={{
          padding: "1.25rem 2rem 4rem",
          maxWidth: 1080,
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <AnniePlayer
          src={annieUrl}
          height={scaled.height}
          defaultWidth={scaled.width}
          autoLoad={true}
          autoPlay={true}
          fps={30}
        />

        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
            Direct URL
          </h3>
          <CodeBlock>{annieUrl}</CodeBlock>
        </div>

        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
            Convert to Animated PNG
          </h3>
          <CodeBlock>
            {`curl '${annieUrl}' \\
  | tar -xO | ffmpeg -f image2pipe -framerate 30 -i - -plays 0 -c:v apng -f apng ${annieId}.png`}
          </CodeBlock>
        </div>
      </main>
    </>
  );
}
