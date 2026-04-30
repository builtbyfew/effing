// Exposes the preview JSON for an effie at /preview/effie/:effieId.json so that
// agents can fetch an effie (and follow the signed annie/image URLs it contains)
// without having to scrape the HTML preview page or sign their own URL segments.
import invariant from "tiny-invariant";
import { ensureFnRuntime } from "~/fn.server";
import { parseBoundsFromUrl } from "~/urls.server";
import { fnModule, effieResponse } from "@effing/fn";
import type { Route } from "./+types/preview.effie.$effieId[.json]";

export async function loader({ request, params }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { previewProps, runner, propsSchema } = await fnModule(
    "effie",
    params.effieId,
  );

  if (propsSchema) {
    invariant(
      propsSchema.safeParse(previewProps).success,
      "previewProps does not adhere to the propsSchema",
    );
  }

  const effie = await runner({
    props: previewProps,
    bounds: parseBoundsFromUrl(request.url),
  });

  return effieResponse(effie, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
