import { invalidateReportCache } from "@/lib/cache/invalidation";
import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeApi } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createOpportunityRepository } from "./queries";
import { createOpportunitiesService } from "./service";
import { OpportunityError } from "./types";

type Service = ReturnType<typeof createOpportunitiesService>;
const headers = { "Cache-Control": "private, no-store" };
export async function readOpportunityJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new OpportunityError(415, "Send details as JSON.");
  const text = await request.text();
  if (text.length > 65536) throw new OpportunityError(413, "Opportunity details are too large.");
  try { return JSON.parse(text); } catch { throw new OpportunityError(400, "Details contain invalid JSON."); }
}
export async function opportunityApi(request: Request, run: (service: Service) => Promise<{ data: unknown; status?: number }>, mutation = false) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  try {
    if (mutation && request.headers.get("origin") !== new URL(request.url).origin) throw new OpportunityError(403, "Submit this request from the CRM application.");
    const service = createOpportunitiesService(createOpportunityRepository(await createClient()), auth.access);
    const result = await run(service);
    return NextResponse.json(result.data, { status: result.status ?? 200, headers });
  } catch (error) {
    if (error instanceof OpportunityError) return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status, headers });
    return NextResponse.json({ error: "Opportunities are temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
export function invalidateOpportunity(id: string) { invalidateReportCache(false);
  revalidatePath("/dashboard", "layout"); revalidatePath("/reports", "layout");
  revalidatePath("/opportunities"); revalidatePath(`/opportunities/${id}`); revalidatePath(`/opportunities/${id}/edit`);
  revalidatePath("/contacts", "layout");
}
export function invalidateConfiguration() { invalidateReportCache(false); revalidatePath("/dashboard", "layout"); revalidatePath("/reports", "layout"); revalidatePath("/settings"); revalidatePath("/opportunities", "layout"); }
