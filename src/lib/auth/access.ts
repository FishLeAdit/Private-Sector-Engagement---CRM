import "server-only";
import { cache } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { canManageTargets } from "./roles";
import { resolveAccess, type AccessResult } from "./session";

export async function getClientAccess(supabase: SupabaseClient<Database>): Promise<AccessResult> {
  return resolveAccess({
    async verifyUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (error.name === "AuthSessionMissingError" || [400, 401, 403].includes(error.status ?? 0)) return null;
        throw error;
      }
      return data.user;
    },
    async loadProfile(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,department,role,active")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// React cache deduplicates only within a render pass, never across users/requests.
export const getAccess = cache(async (): Promise<AccessResult> => {
  try {
    return await getClientAccess(await createClient());
  } catch (error) {
    // Preserve Next.js request-only rendering and redirect control-flow errors.
    unstable_rethrow(error);
    return { status: "unavailable" };
  }
});

export async function requirePseUser() {
  const access = await getAccess();
  if (access.status === "anonymous") redirect("/login");
  if (access.status === "forbidden") redirect("/access-denied");
  if (access.status !== "allowed") throw new Error("Sign-in services are unavailable. Please try again.");
  return access;
}

export async function authorizeApi({ manager = false } = {}) {
  const access = await getAccess();
  if (access.status === "allowed" && (!manager || canManageTargets(access.profile))) {
    return { ok: true as const, access };
  }
  const status = access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403;
  const error = status === 401 ? "Sign in required" : status === 503 ? "Sign-in services unavailable" : "Access denied";
  return {
    ok: false as const,
    response: NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } }),
  };
}
