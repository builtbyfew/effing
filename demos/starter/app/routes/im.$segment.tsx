import { ensureFnRuntime } from "~/fn.server";
import { deserialize } from "@effing/serde";
import { fnModule, imageResponse } from "@effing/fn";
import type { Route } from "./+types/im.$segment";

export async function loader({ params, request }: Route.LoaderArgs) {
  ensureFnRuntime();

  const payload = await deserialize<{ imageId: string }>(
    params.segment,
    process.env.SECRET_KEY!,
  );

  const { imageId, ...props } = payload;
  const { runner, propsSchema } = await fnModule("image", imageId);

  if (propsSchema) {
    propsSchema.parse(props);
  }

  const url = new URL(request.url);
  const width = parseInt(url.searchParams.get("w") || "1080", 10);
  const height = parseInt(url.searchParams.get("h") || "1080", 10);

  const buffer = await runner({ props, bounds: { width, height } });

  const noCache = url.searchParams.get("cache") === "no";

  return imageResponse(buffer, {
    ...(noCache && { cacheControl: "no-store" }),
  });
}
