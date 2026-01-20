import { deserialize } from "@effing/serde";
import { effieResponse } from "@effing/effie";
import { getEffie } from "~/effies";
import type { Route } from "./+types/ff.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  // Deserialize the signed URL segment
  const { effieId, ...props } = await deserialize<{
    effieId: string;
  }>(params.segment, process.env.SECRET_KEY!);

  const { renderer, propsSchema } = await getEffie(effieId);

  // Validate props if schema exists
  if (propsSchema) {
    propsSchema.parse(props);
  }

  // Get dimensions from query params
  const url = new URL(request.url);
  const width = parseInt(url.searchParams.get("w") || "1080", 10);
  const height = parseInt(url.searchParams.get("h") || "1080", 10);

  const effieData = await renderer({ props, width, height });

  return effieResponse(effieData);
}
