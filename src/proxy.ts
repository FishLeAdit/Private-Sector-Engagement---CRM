import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) { return updateSession(request); }

export const config = {
  matcher: ["/", "/login", "/access-denied", "/api/:path*", "/dashboard/:path*", "/contacts/:path*", "/opportunities/:path*", "/meetings/:path*", "/activities/:path*", "/contributions/:path*", "/targets/:path*", "/reports/:path*", "/settings/:path*"],
};
