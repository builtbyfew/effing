import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { ensureFnRuntime } from "~/fn.server";
import { fnModule, fnUrl } from "@effing/fn";
import type { Route } from "./+types/preview.image.$imageId";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { previewProps, propsSchema } = await fnModule("image", params.imageId);
  invariant(
    propsSchema.safeParse(previewProps).success,
    "previewProps does not adhere to the propsSchema",
  );

  const searchParams = new URL(request.url).searchParams;
  const width = parseInt(searchParams.get("w") || "1080", 10);
  const height = parseInt(searchParams.get("h") || "1080", 10);

  const url = await fnUrl(
    "image",
    params.imageId,
    previewProps as Record<string, unknown>,
    { width, height },
  );

  return {
    imageId: params.imageId,
    imageUrl: `${url}&cache=no`,
    width,
    height,
  };
}

export default function ImagePreviewPage() {
  const { imageId, imageUrl, width, height } = useLoaderData<typeof loader>();

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
      <h1 style={{ margin: 0 }}>Image Preview: {imageId}</h1>

      <img
        src={imageUrl}
        width={scaledDimensions.width}
        height={scaledDimensions.height}
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
