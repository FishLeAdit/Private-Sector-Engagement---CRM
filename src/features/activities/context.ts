import "server-only";
import { requirePseUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createActivityRepository } from "./queries";
import { createActivitiesService } from "./service";
import { ActivityError } from "./types";
export async function activityPageContext() {
  const access = await requirePseUser();
  return { access, service: createActivitiesService(createActivityRepository(await createClient()), access) };
}
export async function activityPageData<T>(load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (error instanceof ActivityError) return { ok: false as const, error };
    throw error;
  }
}
