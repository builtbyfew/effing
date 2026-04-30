import { ensureFnRuntime } from "~/fn.server";
import { deserializeUrlSegment } from "~/urls.server";
import { fnModule, effieResponse } from "@effing/fn";
import type { Route } from "./+types/effie.$segment";

export async function loader({ params }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { id, props, width, height } = await deserializeUrlSegment(
    params.segment,
  );

  const { runner, propsSchema } = await fnModule("effie", id);

  if (propsSchema) {
    propsSchema.parse(props);
  }

  const effieData = await runner({ props, bounds: { width, height } });

  return effieResponse(effieData, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
