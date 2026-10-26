import { authorizeApi } from "@/lib/auth/access";

export async function GET() {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  return Response.json({ error: "Not implemented" }, { status: 501, headers: { "Cache-Control": "private, no-store" } });
}

// TODO: Validate requests and delegate to shared feature services with caller-scoped access.
