import type { ActionFunctionArgs } from "react-router";
import { ffsBaseUrl, ffsHeaders } from "../ffs.server";

export async function action({
  request,
}: ActionFunctionArgs): Promise<Response> {
  const baseUrl = ffsBaseUrl();
  if (!baseUrl) {
    return Response.json({ error: "FFS not configured" }, { status: 503 });
  }

  const body = await request.text();

  try {
    const upstream = await fetch(`${baseUrl}/purge`, {
      method: "POST",
      headers: ffsHeaders(),
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
