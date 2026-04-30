import { ensureFnRuntime } from "~/fn.server";
import { deserializeUrlSegment } from "~/urls.server";
import { fnModule, imageResponse } from "@effing/fn";
import type { Route } from "./+types/image.$segment";

export async function loader({ params }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { id, props, width, height } = await deserializeUrlSegment(
    params.segment,
  );

  const { runner, propsSchema } = await fnModule("image", id);

  if (propsSchema) {
    propsSchema.parse(props);
  }

  const buffer = await runner({ props, bounds: { width, height } });

  return imageResponse(buffer, {
    cacheControl:
      process.env.NODE_ENV !== "production" ? "no-store" : undefined,
  });
}
