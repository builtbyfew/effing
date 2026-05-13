import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { fnModule, fnUrl } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";
import { getResolutions, type Resolution } from "../resolutions.server";
import { getProjectName } from "../project.server";
import { Header } from "../components/Header";
import { CodeBlock } from "../components/Preview";

export type ImagePreviewData = {
  projectName: string;
  imageId: string;
  imageUrl: string;
  width: number;
  height: number;
  resolutions: Resolution[];
};

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<ImagePreviewData> {
  ensureFnRuntime();
  const imageId = params.imageId!;
  const { previewProps, propsSchema } = await fnModule("image", imageId);
  if (!propsSchema.safeParse(previewProps).success) {
    throw new Error("previewProps does not adhere to the propsSchema");
  }

  const { width, height } = parseBoundsFromUrl(request.url);

  const url = await fnUrl(
    "image",
    imageId,
    previewProps as Record<string, unknown>,
    { width, height },
  );

  return {
    projectName: getProjectName(),
    imageId,
    imageUrl: url,
    width,
    height,
    resolutions: getResolutions(),
  };
}

export default function ImagePreviewPage() {
  const { projectName, imageId, imageUrl, width, height, resolutions } =
    useLoaderData() as ImagePreviewData;
  const scaled = {
    width: Math.round((540 * width) / height),
    height: 540,
  };

  return (
    <>
      <Header
        projectName={projectName}
        current={{
          kind: "image",
          id: imageId,
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

        <img
          src={imageUrl}
          width={scaled.width}
          height={scaled.height}
          alt={imageId}
          style={{
            border: "1px solid var(--color-coal-light-5)",
            backgroundColor: "var(--color-snow)",
          }}
        />

        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
            Direct URL
          </h3>
          <CodeBlock>{imageUrl}</CodeBlock>
        </div>
      </main>
    </>
  );
}
