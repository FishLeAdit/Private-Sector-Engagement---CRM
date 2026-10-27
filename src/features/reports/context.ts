import "server-only";
import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/api/handler";
import { authorizeApi, requirePseUser } from "@/lib/auth/access";
import { loadPageData } from "@/lib/page-data";
import { createClient } from "@/lib/supabase/server";
import { reportRequestService } from "./request-service";
import { ReportError } from "./types";

export async function reportsPage() {
  const access = await requirePseUser();
  return reportRequestService(access, await createClient());
}

export const reportData = <T>(load: () => Promise<T>) => loadPageData(ReportError, load);

// Reports use their own handler: the cached request service is built per caller,
// and Server-Timing exposes total handler time for later HTTP measurements.
export async function reportsApi(request: Request) {
  const started = performance.now();
  const finish = (response: NextResponse) => {
    response.headers.set("Server-Timing", `report;dur=${(performance.now() - started).toFixed(1)}`);
    return response;
  };
  const auth = await authorizeApi();
  if (!auth.ok) return finish(auth.response);
  try {
    const service = await reportRequestService(auth.access, await createClient());
    const filters = Object.fromEntries(new URL(request.url).searchParams);
    return finish(NextResponse.json(await service.read(filters), { headers: noStoreHeaders }));
  } catch (error) {
    if (error instanceof ReportError) {
      return finish(NextResponse.json({ error: error.message }, { status: error.status, headers: noStoreHeaders }));
    }
    const unavailable = { error: "Reports are temporarily unavailable. Please try again." };
    return finish(NextResponse.json(unavailable, { status: 503, headers: noStoreHeaders }));
  }
}
