import type { LoaderFunctionArgs } from "react-router";
import { fnModule, effieResponse } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { verifySegment } from "../urls.server";

export async function loader({
  params,
}: LoaderFunctionArgs): Promise<Response> {
  ensureFnRuntime();
  const { id, props, bounds } = await verifySegment(params.segment!);
  const { runner, propsSchema } = await fnModule("effie", id);
  const parsedProps = propsSchema ? propsSchema.parse(props ?? {}) : props;
  const effieData = await runner({ props: parsedProps, bounds });
  return effieResponse(effieData, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
