import type { LoaderFunctionArgs } from "react-router";
import { fnModule, annieResponse } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { verifySegment } from "../urls.server";

export async function loader({
  params,
  request,
}: LoaderFunctionArgs): Promise<Response> {
  ensureFnRuntime();
  const { id, props, bounds } = await verifySegment(params.segment!);
  const { runner, propsSchema } = await fnModule("annie", id);
  const parsedProps = propsSchema.parse(props ?? {});
  const frames = runner({ props: parsedProps, bounds });
  return annieResponse(frames, {
    signal: request.signal,
    filename: id,
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
