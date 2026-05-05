// Streams the preview-rendered bytes for an image at /preview/image/:imageId.bytes
// so that agents can fetch the rendered output without scraping the HTML preview
// page or signing their own URL segments. Content-Type is set from the encoded
// payload (image/png or image/jpeg) so the same route handles either encoding.
import invariant from "tiny-invariant";
import { ensureFnRuntime } from "~/fn.server";
import { parseBoundsFromUrl } from "~/urls.server";
import { fnModule, imageResponse } from "@effing/fn";
import type { Route } from "./+types/preview.image.$imageId[.bytes]";

export async function loader({ request, params }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { previewProps, runner, propsSchema } = await fnModule(
    "image",
    params.imageId,
  );

  invariant(
    propsSchema.safeParse(previewProps).success,
    "previewProps does not adhere to the propsSchema",
  );

  const buffer = await runner({
    props: previewProps as Record<string, unknown>,
    bounds: parseBoundsFromUrl(request.url),
  });

  return imageResponse(buffer, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
