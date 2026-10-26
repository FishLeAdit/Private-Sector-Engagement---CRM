import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
import { updateSession } from "../../src/lib/supabase/proxy";

type CookieAdapter = { cookies: { setAll: (cookies: { name: string; value: string; options: { path: string; httpOnly?: boolean } }[]) => void } };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
  mocks.createServerClient.mockReset();
  mocks.createServerClient.mockReturnValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: null, error: null }) } });
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy session boundary", () => {
  it("redirects an anonymous dashboard request to login with a safe return route", async () => {
    const response = await updateSession(new NextRequest("http://localhost/dashboard?year=2026"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fdashboard%3Fyear%3D2026");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns JSON 401 for anonymous API access rather than HTML redirects", async () => {
    const response = await updateSession(new NextRequest("http://localhost/api/contacts"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in required" });
  });
  it("does not accept residual claims when token verification reports an error", async () => {
    mocks.createServerClient.mockReturnValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "fictional-user" } }, error: { status: 401 } }) } });
    expect((await updateSession(new NextRequest("http://localhost/api/contacts"))).status).toBe(401);
  });
  it("allows public login and verified tokens through to server membership checks", async () => {
    expect((await updateSession(new NextRequest("http://localhost/login"))).status).toBe(200);
    mocks.createServerClient.mockReturnValue({ auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "fictional-user" } }, error: null }) } });
    const response = await updateSession(new NextRequest("http://localhost/dashboard"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("preserves refreshed cookies on both request and redirect response", async () => {
    const request = new NextRequest("http://localhost/contacts");
    mocks.createServerClient.mockImplementation((_url: string, _key: string, options: CookieAdapter) => ({
      auth: { getClaims: async () => {
        options.cookies.setAll([{ name: "sb-example-auth-token", value: "fictional-refreshed-cookie", options: { path: "/", httpOnly: true } }]);
        return { data: null, error: null };
      } },
    }));
    const response = await updateSession(request);
    expect(request.cookies.get("sb-example-auth-token")?.value).toBe("fictional-refreshed-cookie");
    expect(response.cookies.get("sb-example-auth-token")?.value).toBe("fictional-refreshed-cookie");
    expect(response.status).toBe(307);
  });
  it("preserves cookie updates across multiple refresh callbacks", async () => {
    mocks.createServerClient.mockImplementation((_url: string, _key: string, options: CookieAdapter) => ({
      auth: { getClaims: async () => {
        options.cookies.setAll([{ name: "sb-first", value: "first", options: { path: "/" } }]);
        options.cookies.setAll([{ name: "sb-second", value: "second", options: { path: "/" } }]);
        return { data: { claims: { sub: "fictional-user" } }, error: null };
      } },
    }));
    const response = await updateSession(new NextRequest("http://localhost/dashboard"));
    expect(response.cookies.get("sb-first")?.value).toBe("first");
    expect(response.cookies.get("sb-second")?.value).toBe("second");
  });
  it("fails closed during provider outages and returns a recoverable public page", async () => {
    mocks.createServerClient.mockReturnValue({ auth: { getClaims: vi.fn().mockRejectedValue(new Error("Provider offline")) } });
    expect((await updateSession(new NextRequest("http://localhost/dashboard"))).status).toBe(503);
    const api = await updateSession(new NextRequest("http://localhost/api/targets"));
    expect(api.status).toBe(503);
    expect((await updateSession(new NextRequest("http://localhost/login"))).status).toBe(200);
  });
});
