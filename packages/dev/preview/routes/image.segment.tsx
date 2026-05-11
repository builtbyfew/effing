import type { LoaderFunctionArgs } from "react-router";
import { fnModule, imageResponse } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { verifySegment } from "../urls.server";

export async function loader({
  params,
}: LoaderFunctionArgs): Promise<Response> {
  ensureFnRuntime();
  const { id, props, bounds } = await verifySegment(params.segment!);
  const { runner, propsSchema } = await fnModule("image", id);
  const parsedProps = propsSchema.parse(props ?? {});
  const buffer = await runner({ props: parsedProps, bounds });
  return imageResponse(buffer, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
