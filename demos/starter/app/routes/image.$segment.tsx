import { ensureFnRuntime } from "~/fn.server";
import { deserializeUrlSegment } from "~/urls.server";
import { fnModule, imageResponse } from "@effing/fn";
import type { Route } from "./+types/image.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { id, props, width, height } = await deserializeUrlSegment(
    params.segment,
  );

  const { runner, propsSchema } = await fnModule("image", id);

  if (propsSchema) {
    propsSchema.parse(props);
  }

  const buffer = await runner({ props, bounds: { width, height } });

  const noCache = new URL(request.url).searchParams.get("cache") === "no";

  return imageResponse(buffer, {
    ...(noCache && { cacheControl: "no-store" }),
  });
}
