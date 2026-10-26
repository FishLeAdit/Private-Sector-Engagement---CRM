import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getSupabaseConfig } from "./config";
import { safeReturnPath } from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const finish = (result: NextResponse) => {
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
    result.headers.set("Cache-Control", "private, no-store, max-age=0");
    result.headers.set("Pragma", "no-cache");
    return result;
  };
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const isPublic = ["/", "/login", "/access-denied"].includes(pathname);
  try {
    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          for (const cookie of previousCookies) response.cookies.set(cookie);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
    const { data, error } = await supabase.auth.getClaims();
    // Provider failure is distinct from an absent/invalid session.
    if (error && error.name !== "AuthSessionMissingError" && ![400, 401, 403].includes(error.status ?? 0)) throw error;
    if ((error || !data?.claims?.sub) && !isPublic) {
      if (isApi) return finish(NextResponse.json({ error: "Sign in required" }, { status: 401 }));
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      login.searchParams.set("next", safeReturnPath(pathname + request.nextUrl.search));
      return finish(NextResponse.redirect(login));
    }
    // Fresh membership is enforced again in pages/actions/API services, with RLS below them.
    return finish(response);
  } catch {
    if (isPublic) return finish(response);
    if (isApi) return finish(NextResponse.json({ error: "Sign-in services unavailable" }, { status: 503 }));
    return finish(new NextResponse("Sign-in services are unavailable. Please try again.", { status: 503 }));
  }
}
