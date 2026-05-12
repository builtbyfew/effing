import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { fnModule, imageResponse } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<Response> {
  ensureFnRuntime();
  const { previewProps, runner, propsSchema } = await fnModule(
    "image",
    params.imageId!,
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
