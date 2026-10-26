import { NextResponse } from "next/server";

// Next.js 16 uses proxy.ts in place of middleware.ts.
// TODO: Refresh Supabase sessions; enforce authorization in services and RLS.
export function proxy() {
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/contacts/:path*", "/opportunities/:path*", "/meetings/:path*", "/activities/:path*", "/targets/:path*", "/reports/:path*", "/settings/:path*"] };
