import { annieResponse } from "@effing/annie";
import { deserialize } from "@effing/serde";
import { getAnnie } from "~/annies";
import type { Route } from "./+types/an.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  // Deserialize the signed URL segment
  const payload = await deserialize<{ annieId: string }>(
    params.segment,
    process.env.SECRET_KEY!,
  );

  const { annieId, ...props } = payload;
  const { renderer, propsSchema } = await getAnnie(annieId);

  // Validate props if schema exists
  if (propsSchema) {
    propsSchema.parse(props);
  }

  // Get dimensions from query params
  const url = new URL(request.url);
  const width = parseInt(url.searchParams.get("w") || "1080", 10);
  const height = parseInt(url.searchParams.get("h") || "1080", 10);

  const noCache = url.searchParams.get("cache") === "no";
  const frames = renderer({ props, width, height });

  return annieResponse(frames, {
    signal: request.signal,
    filename: annieId,
    ...(noCache && { cacheControl: "no-store" }),
  });
}
