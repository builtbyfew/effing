import { ensureFnRuntime } from "~/fn.server";
import { deserializeUrlSegment } from "~/urls.server";
import { fnModule, annieResponse } from "@effing/fn";
import type { Route } from "./+types/annie.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { id, props, width, height } = await deserializeUrlSegment(
    params.segment,
  );

  const { runner, propsSchema } = await fnModule("annie", id);

  if (propsSchema) {
    propsSchema.parse(props);
  }

  const frames = runner({ props, bounds: { width, height } });

  return annieResponse(frames, {
    signal: request.signal,
    filename: id,
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
