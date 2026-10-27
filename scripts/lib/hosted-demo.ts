// Administrative CLI utilities only; never import into application/browser code.
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
export class SeedError extends Error {}
export function requireResult<T>(
  { data, error, status }: { data: T; error: { code?: string; message?: string } | null; status?: number },
  action: string,
): NonNullable<T> {
  if (error) {
    const reason =
      error.code ||
      (/invalid.*key|invalid.*jwt/i.test(error.message ?? "")
        ? "invalid API key"
        : /fetch failed|network/i.test(error.message ?? "")
          ? "network connection failed"
          : "provider error");
    throw new SeedError(
      `${action} failed (${reason}${status ? `, HTTP ${status}` : ""}). No raw provider details or credentials are displayed. Refresh and rerun after resolving the issue.`,
    );
  }
  if (data == null) throw new SeedError(`${action} returned no result.`);
  return data;
}
export function createHostedDemoClient() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new SeedError(
      "Configure NEXT_PUBLIC_SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY privately in .env.local. Never paste the key into chat or commit it.",
    );
  let serviceRole = key.startsWith("sb_secret_");
  if (key.startsWith("eyJ")) {
    try {
      serviceRole = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "service_role";
    } catch {
      /* Reject malformed private configuration below. */
    }
  }
  if (!serviceRole || /your-|placeholder/i.test(key))
    throw new SeedError(
      "SUPABASE_SERVICE_ROLE_KEY is still a placeholder or is not a server-side secret/service_role key. Replace it privately in .env.local; do not paste it into chat.",
    );
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new SeedError("The configured Supabase URL is invalid.");
  return createClient<Database>(parsed.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
