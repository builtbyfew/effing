import { ensureFnRuntime } from "~/fn.server";
import { deserialize } from "@effing/serde";
import { fnModule, effieResponse } from "@effing/fn";
import type { Route } from "./+types/ff.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const { effieId, ...props } = await deserialize<{
    effieId: string;
  }>(params.segment, process.env.SECRET_KEY!);

  const { runner, propsSchema } = await fnModule("effie", effieId);

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
