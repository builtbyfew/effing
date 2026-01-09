import { deserialize } from "@effing/serde";
import { effieResponse } from "@effing/effie";
import { getEffie } from "~/effies";
import { dimensionsFromAspectRatio } from "~/dimensions.server";
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

  // Get aspect ratio from query params
  const url = new URL(request.url);
  const aspectRatio = url.searchParams.get("ratio") || "9:16";
  const { width, height } = dimensionsFromAspectRatio(aspectRatio);

  const effieData = await renderer({ props, width, height });

  return effieResponse(effieData);
}
