import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { fnModule, fnUrl } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";
import { getResolutions, type Resolution } from "../resolutions.server";

export type ImagePreviewData = {
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
    imageId,
    imageUrl: url,
    width,
    height,
    resolutions: getResolutions(),
  };
}

export default function ImagePreviewPage() {
  const { imageId, imageUrl, width, height, resolutions } =
    useLoaderData() as ImagePreviewData;
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
        <h1 style={{ margin: 0 }}>Image Preview: {imageId}</h1>
        <p style={{ color: "#666" }}>
          Resolution:{" "}
          {resolutions.map((r, i) => {
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
                    href={`/preview/image/${imageId}?w=${r.width}&h=${r.height}`}
                  >
                    {r.width}x{r.height} ({r.label})
                  </a>
                )}
              </span>
            );
          })}
        </p>
      </div>

      <img
        src={imageUrl}
        width={scaled.width}
        height={scaled.height}
        alt={imageId}
        style={{ border: "1px solid #ddd" }}
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
          {imageUrl}
        </pre>
      </div>
    </div>
  );
}
