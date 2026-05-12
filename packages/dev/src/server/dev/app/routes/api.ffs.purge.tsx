import type { ActionFunctionArgs } from "react-router";

export async function action({
  request,
}: ActionFunctionArgs): Promise<Response> {
  if (!process.env.FFS_BASE_URL || !process.env.FFS_API_KEY) {
    return Response.json({ error: "FFS not configured" }, { status: 503 });
  }

  const body = await request.text();

  try {
    const upstream = await fetch(`${process.env.FFS_BASE_URL}/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FFS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
