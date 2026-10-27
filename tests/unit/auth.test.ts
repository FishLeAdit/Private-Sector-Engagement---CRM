import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
import type { AccessProfile } from "../../src/lib/auth/roles";

vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "../../src/lib/supabase/server";
import { authorizeApi, getClientAccess } from "../../src/lib/auth/access";
import { canManageTargets, isActivePseProfile } from "../../src/lib/auth/roles";
import { resolveAccess, safeReturnPath } from "../../src/lib/auth/session";
import { parseSupabaseConfig } from "../../src/lib/supabase/config";
import { signInWithAccess } from "../../src/features/auth/service";

const profile: AccessProfile = {
  id: "demo-user",
  display_name: "Fictional Member",
  department: "PSE",
  role: "pse_member",
  active: true,
};

function clientFor(p: AccessProfile | null = profile, user: { id: string } | null = { id: profile.id }) {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  const maybeSingle = vi.fn().mockResolvedValue({ data: p, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { auth, from } as unknown as SupabaseClient<Database>, auth, from, eq, maybeSingle };
}

beforeEach(() => vi.clearAllMocks());

describe("verified user and PSE membership", () => {
  it.each(["pse_member", "pse_manager", "admin"])("allows active PSE role %s", async role => {
    expect((await getClientAccess(clientFor({ ...profile, role }).client)).status).toBe("allowed");
  });
  it.each([
    null,
    { ...profile, active: false },
    { ...profile, department: "HR" },
    { ...profile, role: "unknown" },
    { ...profile, id: "someone-else" },
  ])("denies missing, inactive, non-PSE, invalid or mismatched membership %#", async p => {
    expect((await getClientAccess(clientFor(p).client)).status).toBe("forbidden");
  });
  it("does not query profiles when there is no verified user", async () => {
    const fixture = clientFor(null, null);
    expect((await getClientAccess(fixture.client)).status).toBe("anonymous");
    expect(fixture.from).not.toHaveBeenCalled();
  });
  it("loads only the verified user's profile", async () => {
    const fixture = clientFor();
    await getClientAccess(fixture.client);
    expect(fixture.eq).toHaveBeenCalledWith("id", profile.id);
  });
  it("fails closed when identity or profile providers fail", async () => {
    const fixture = clientFor();
    fixture.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } });
    expect((await getClientAccess(fixture.client)).status).toBe("unavailable");
    fixture.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Database unavailable" } });
    expect((await getClientAccess(fixture.client)).status).toBe("unavailable");
    expect(
      (
        await resolveAccess({
          verifyUser: async () => {
            throw new Error("Offline");
          },
          loadProfile: async () => profile,
        })
      ).status,
    ).toBe("unavailable");
  });
  it("treats rejected sessions as anonymous", async () => {
    const fixture = clientFor();
    fixture.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    expect((await getClientAccess(fixture.client)).status).toBe("anonymous");
  });
  it("restricts target management to active PSE managers/admins", () => {
    expect(canManageTargets(profile)).toBe(false);
    expect(canManageTargets({ ...profile, role: "pse_manager" })).toBe(true);
    expect(canManageTargets({ ...profile, role: "admin" })).toBe(true);
    expect(canManageTargets({ ...profile, role: "admin", department: "HR" })).toBe(false);
    expect(canManageTargets({ ...profile, role: "pse_manager", active: false })).toBe(false);
    expect(isActivePseProfile(null)).toBe(false);
  });
});

describe("HTTP authorization", () => {
  it.each([
    { p: null, user: null, status: 401 },
    { p: null, user: { id: profile.id }, status: 403 },
    { p: { ...profile, active: false }, user: { id: profile.id }, status: 403 },
  ])("returns $status for rejected access", async ({ p, user, status }) => {
    vi.mocked(createClient).mockResolvedValue(clientFor(p, user).client);
    const result = await authorizeApi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(status);
      expect(result.response.headers.get("cache-control")).toContain("no-store");
    }
  });
  it("returns 503 during provider failure instead of granting access", async () => {
    vi.mocked(createClient).mockRejectedValueOnce(new Error("Offline"));
    const result = await authorizeApi();
    expect(!result.ok && result.response.status).toBe(503);
  });
  it("allows member reads but refuses manager operations", async () => {
    vi.mocked(createClient).mockResolvedValue(clientFor().client);
    expect((await authorizeApi()).ok).toBe(true);
    const denied = await authorizeApi({ manager: true });
    expect(!denied.ok && denied.response.status).toBe(403);
    vi.mocked(createClient).mockResolvedValue(clientFor({ ...profile, role: "pse_manager" }).client);
    expect((await authorizeApi({ manager: true })).ok).toBe(true);
  });
});

describe("sign-in service", () => {
  it("permits sign-in only after membership verification", async () => {
    const fixture = clientFor();
    expect((await signInWithAccess(fixture.client, "demo@example.invalid", "fictional-password")).ok).toBe(true);
    expect(fixture.auth.getUser).toHaveBeenCalled();
    expect(fixture.auth.signOut).not.toHaveBeenCalled();
  });
  it("clears the new session for a restricted account", async () => {
    const fixture = clientFor(null);
    const result = await signInWithAccess(fixture.client, "restricted@example.invalid", "fictional-password");
    expect(result.ok).toBe(false);
    expect(fixture.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not return provider errors or supplied credentials", async () => {
    const fixture = clientFor();
    fixture.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Sensitive provider error" },
    });
    const result = await signInWithAccess(fixture.client, "demo@example.invalid", "fictional-password");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/Sensitive|fictional-password|demo@example/);
    expect(fixture.from).not.toHaveBeenCalled();
  });
});

describe("safe redirect and public configuration", () => {
  it.each([
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/contacts/../../login",
    "/login",
    "/api/contacts",
    "/dashboard\nLocation:evil",
    undefined,
    ["/contacts"],
  ])("rejects unsafe return path %#", value => expect(safeReturnPath(value)).toBe("/dashboard"));
  it("preserves a permitted nested route and its filters", () => {
    expect(safeReturnPath("/contacts/demo?tab=activity")).toBe("/contacts/demo?tab=activity");
  });
  it("rejects missing configuration and privileged keys without disclosing them", () => {
    expect(() => parseSupabaseConfig(undefined, undefined)).toThrow(/configured/);
    expect(() => parseSupabaseConfig("javascript:alert(1)", "sb_publishable_demo")).toThrow(/HTTP/);
    expect(() => parseSupabaseConfig("https://example.supabase.co", "sb_secret_fictional")).toThrow(/publishable/);
    const serviceJwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: "service_role" }))}.example`;
    expect(() => parseSupabaseConfig("https://example.supabase.co", serviceJwt)).toThrow(/publishable/);
    expect(parseSupabaseConfig("https://example.supabase.co", "sb_publishable_demo").url).toBe(
      "https://example.supabase.co",
    );
  });
});
