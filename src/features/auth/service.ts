import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getClientAccess } from "@/lib/auth/access";

export async function signInWithAccess(client: SupabaseClient<Database>, email: string, password: string) {
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false as const, error: "Unable to sign in. Check your email and password, then try again." };
    const access = await getClientAccess(client);
    if (access.status === "allowed") return { ok: true as const };
    await client.auth.signOut({ scope: "local" });
    return {
      ok: false as const,
      error: access.status === "forbidden"
        ? "This account does not have PSE access. Contact your administrator."
        : "We could not verify access. Please try again shortly.",
    };
  } catch {
    return { ok: false as const, error: "Sign-in is temporarily unavailable. Please try again shortly." };
  }
}
