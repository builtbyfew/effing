import { ensureFnRuntime } from "~/fn.server";
import { deserialize } from "@effing/serde";
import { fnModule, effieResponse } from "@effing/fn";
import type { Route } from "./+types/effie.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { id, props } = await deserialize<{
    id: string;
    props: Record<string, unknown>;
  }>(params.segment, process.env.SECRET_KEY!);

  const { runner, propsSchema } = await fnModule("effie", id);

  // Validate props if schema exists
  if (propsSchema) {
    propsSchema.parse(props);
  }

  // Get dimensions from query params
  const url = new URL(request.url);
  const width = parseInt(url.searchParams.get("w") || "1080", 10);
  const height = parseInt(url.searchParams.get("h") || "1080", 10);

  const effieData = await runner({ props, bounds: { width, height } });

  return effieResponse(effieData);
}
