import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { requirePseUser } from "@/lib/auth/access";
import type { AccessResult } from "@/lib/auth/session";
import type { AppError, AppErrorClass } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// Redirects anonymous or non-PSE visitors before any page data is read.
export async function createPageContext<S>(
  createService: (client: SupabaseClient<Database>, access: AccessResult) => S,
) {
  const access = await requirePseUser();
  return { access, service: createService(await createClient(), access) };
}

// Turns the module's own errors into a value the page can render; anything else reaches the error boundary.
export async function loadPageData<T, E extends AppError>(ErrorClass: AppErrorClass<E>, load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (error instanceof ErrorClass) return { ok: false as const, error };
    throw error;
  }
}
