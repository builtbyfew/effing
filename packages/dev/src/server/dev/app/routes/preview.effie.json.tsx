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
  let props: unknown = previewProps;
  if (propsSchema) {
    const parsed = propsSchema.safeParse(previewProps);
    invariant(
      parsed.success,
      "previewProps does not adhere to the propsSchema",
    );
    props = parsed.data;
  }
  const effie = await runner({
    props,
    bounds: parseBoundsFromUrl(request.url),
  });
  return effieResponse(effie, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
