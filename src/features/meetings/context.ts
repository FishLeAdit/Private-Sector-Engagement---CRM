import "server-only";
import { requirePseUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createMeetingRepository } from "./queries";
import { createMeetingsService } from "./service";
import { MeetingError } from "./types";

export async function meetingPageContext() {
  const access = await requirePseUser();
  return { access, service: createMeetingsService(createMeetingRepository(await createClient()), access) };
}
export async function meetingPageData<T>(load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (error instanceof MeetingError) return { ok: false as const, error };
    throw error;
  }
}
