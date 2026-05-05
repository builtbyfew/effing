// Streams the preview-rendered TAR for an annie at /preview/annie/:annieId.tar
// so that agents can fetch the rendered frames without scraping the HTML preview
// page or signing their own URL segments.
import invariant from "tiny-invariant";
import { ensureFnRuntime } from "~/fn.server";
import { parseBoundsFromUrl } from "~/urls.server";
import { fnModule, annieResponse } from "@effing/fn";
import type { Route } from "./+types/preview.annie.$annieId[.tar]";

export async function loader({ request, params }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { previewProps, runner, propsSchema } = await fnModule(
    "annie",
    params.annieId,
  );

  invariant(
    propsSchema.safeParse(previewProps).success,
    "previewProps does not adhere to the propsSchema",
  );

  const frames = runner({
    props: previewProps as Record<string, unknown>,
    bounds: parseBoundsFromUrl(request.url),
  });

  return annieResponse(frames, {
    signal: request.signal,
    filename: params.annieId,
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
