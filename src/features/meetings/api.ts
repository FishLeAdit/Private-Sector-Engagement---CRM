import { invalidateReportCache } from "@/lib/cache/invalidation";
import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeApi } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createMeetingRepository } from "./queries";
import { createMeetingsService } from "./service";
import { MeetingError } from "./types";

type Service = ReturnType<typeof createMeetingsService>;
const headers = { "Cache-Control": "private, no-store" };
export async function readMeetingJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new MeetingError(415, "Send meeting details as JSON.");
  const text = await request.text();
  if (text.length > 65536) throw new MeetingError(413, "Meeting details are too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new MeetingError(400, "Meeting details contain invalid JSON.");
  }
}
export async function meetingApi(
  request: Request,
  run: (service: Service) => Promise<{ data: unknown; status?: number }>,
  mutation = false,
) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  try {
    if (mutation && request.headers.get("origin") !== new URL(request.url).origin)
      throw new MeetingError(403, "Submit this request from the CRM application.");
    const service = createMeetingsService(createMeetingRepository(await createClient()), auth.access),
      result = await run(service);
    return NextResponse.json(result.data, { status: result.status ?? 200, headers });
  } catch (error) {
    if (error instanceof MeetingError)
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status, headers });
    return NextResponse.json(
      { error: "Meetings are temporarily unavailable. Please try again." },
      { status: 503, headers },
    );
  }
}
export function invalidateMeeting(id: string) {
  invalidateReportCache(false);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/reports", "layout");
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  revalidatePath(`/meetings/${id}/edit`);
  revalidatePath("/contacts", "layout");
  revalidatePath("/opportunities", "layout");
  revalidatePath("/activities", "layout");
}
