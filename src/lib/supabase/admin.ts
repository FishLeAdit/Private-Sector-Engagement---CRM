import "server-only";
import { createClient } from "@supabase/supabase-js";

// The service-role client, used only for Supabase Auth admin calls: creating and deleting sign-in accounts and
// setting passwords. Callers must have verified an active superadmin first, because this key bypasses RLS.
// Profile changes never use it; they go through caller-scoped RPCs. Returns null when the server has no
// SUPABASE_SERVICE_ROLE_KEY, so account editing keeps working while sign-in changes are unavailable.
export function createAuthAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || /your-|placeholder/i.test(key) || !isServiceKey(key)) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.admin;
}
export type AuthAdmin = NonNullable<ReturnType<typeof createAuthAdmin>>;

function isServiceKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  if (!key.startsWith("eyJ")) return false;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "service_role";
  } catch {
    return false;
  }
}
