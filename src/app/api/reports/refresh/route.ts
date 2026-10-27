import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/access";
import { invalidateUserReportCache } from "@/lib/cache/invalidation";
export async function POST(request: Request) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Refresh reports from this CRM application." }, { status: 403, headers });
  try {
    invalidateUserReportCache(auth.access.userId);
    return NextResponse.json({ refreshed: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Report refresh failed. Please retry." }, { status: 503, headers });
  }
}
