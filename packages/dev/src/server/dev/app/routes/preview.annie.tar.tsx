import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";
import { fnModule, annieResponse } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { parseBoundsFromUrl } from "../urls.server";

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<Response> {
  ensureFnRuntime();
  const annieId = params.annieId!;
  const { previewProps, runner, propsSchema } = await fnModule(
    "annie",
    annieId,
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
    filename: annieId,
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
