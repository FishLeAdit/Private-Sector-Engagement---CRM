import { invalidateReportCache } from "@/lib/cache/invalidation";
import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeApi } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createActivityRepository } from "./queries";
import { createActivitiesService } from "./service";
import { ActivityError } from "./types";
type Service = ReturnType<typeof createActivitiesService>;
export async function readActivityJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new ActivityError(415, "Send activity details as JSON.");
  const value = await request.text();
  if (value.length > 65536) throw new ActivityError(413, "Activity details are too large.");
  try {
    return JSON.parse(value);
  } catch {
    throw new ActivityError(400, "Activity details contain invalid JSON.");
  }
}
export async function activityApi(
  request: Request,
  run: (service: Service) => Promise<{ data: unknown; status?: number }>,
  mutation = false,
) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (mutation && request.headers.get("origin") !== new URL(request.url).origin)
      throw new ActivityError(403, "Submit this request from the CRM application.");
    const result = await run(createActivitiesService(createActivityRepository(await createClient()), auth.access));
    return NextResponse.json(result.data, { status: result.status ?? 200, headers });
  } catch (error) {
    if (error instanceof ActivityError)
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status, headers });
    return NextResponse.json(
      { error: "Activities are temporarily unavailable. Please try again." },
      { status: 503, headers },
    );
  }
}
export function invalidateActivity(id: string) {
  invalidateReportCache(false);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/reports", "layout");
  revalidatePath("/activities");
  revalidatePath(`/activities/${id}`);
  revalidatePath(`/activities/${id}/edit`);
  revalidatePath("/contacts", "layout");
  revalidatePath("/opportunities", "layout");
  revalidatePath("/meetings", "layout");
}
