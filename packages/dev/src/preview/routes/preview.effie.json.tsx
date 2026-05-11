import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { fnModule, effieResponse } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<Response> {
  ensureFnRuntime();
  const { previewProps, runner, propsSchema } = await fnModule(
    "effie",
    params.effieId!,
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
