import "server-only";
import { requirePseUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createContactRepository } from "./queries";
import { createContactsService } from "./service";
import { ContactError } from "./types";

export async function contactPageContext() {
  const access = await requirePseUser();
  return { access, service: createContactsService(createContactRepository(await createClient()), access) };
}

export async function contactPageData<T>(load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (error instanceof ContactError) return { ok: false as const, error };
    throw error;
  }
}
