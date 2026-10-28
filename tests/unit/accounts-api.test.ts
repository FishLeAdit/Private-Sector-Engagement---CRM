import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), repo: vi.fn(), admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/lib/supabase/admin", () => ({ createAuthAdmin: mocks.admin }));
vi.mock("../../src/features/accounts/queries", () => ({ createAccountRepository: mocks.repo }));
import { GET, POST } from "../../src/app/api/accounts/route";
import { DELETE, PATCH } from "../../src/app/api/accounts/[id]/route";
import { POST as PASSWORD } from "../../src/app/api/accounts/[id]/password/route";

const me = "00000000-0000-4000-8000-0000000000a1",
  other = "00000000-0000-4000-8000-0000000000a2",
  created = "00000000-0000-4000-8000-0000000000a3";
let role: string;
let repo: Record<"list" | "save" | "remove", ReturnType<typeof vi.fn>>;
let signIn: Record<"createUser" | "updateUserById" | "deleteUser", ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  role = "admin";
  mocks.authorize.mockImplementation(async () => ({
    ok: true,
    access: {
      status: "allowed",
      userId: me,
      profile: { id: me, display_name: "Fictional", department: "PSE", role, active: true },
    },
  }));
  repo = { list: vi.fn().mockResolvedValue([{ id: other }]), save: vi.fn(), remove: vi.fn().mockResolvedValue(true) };
  mocks.repo.mockReturnValue(repo);
  signIn = {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: created } }, error: null }),
    updateUserById: vi.fn().mockResolvedValue({ error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
  };
  mocks.admin.mockReturnValue(signIn);
});
const request = (method: string, body?: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/accounts", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const context = (id = other) => ({ params: Promise.resolve({ id }) });
const account = {
  email: " New.Person@Fictional.Example ",
  password: "fictional-pass-1",
  display_name: "New Person",
  role: "pse_member",
};
const profile = { display_name: "Renamed", department: "PSE", role: "pse_manager", active: false };

describe("account API", () => {
  it.each(["pse_member", "pse_manager"])("refuses a %s everything, before any read or sign-in change", async value => {
    role = value;
    for (const response of [
      await GET(request("GET")),
      await POST(request("POST", account)),
      await PATCH(request("PATCH", profile), context()),
      await PASSWORD(request("POST", { password: "fictional-pass-2" }), context()),
      await DELETE(request("DELETE"), context()),
    ])
      expect(response.status).toBe(403);
    expect(repo.list).not.toHaveBeenCalled();
    expect(signIn.createUser).not.toHaveBeenCalled();
    expect(signIn.updateUserById).not.toHaveBeenCalled();
  });
  it("lists accounts for a superadmin, privately", async () => {
    const response = await GET(request("GET"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ accounts: [{ id: other }] });
  });
  it("creates a confirmed sign-in and its profile, defaulting to an active PSE account", async () => {
    const response = await POST(request("POST", account));
    expect(response.status).toBe(201);
    expect(signIn.createUser).toHaveBeenCalledWith({
      email: "new.person@fictional.example",
      password: "fictional-pass-1",
      email_confirm: true,
    });
    expect(repo.save).toHaveBeenCalledWith(created, {
      display_name: "New Person",
      department: "PSE",
      role: "pse_member",
      active: true,
    });
  });
  it("removes the new sign-in again when its profile fails, and reports a taken email", async () => {
    repo.save.mockRejectedValueOnce(new Error("profile failed"));
    expect((await POST(request("POST", account))).status).toBe(503);
    expect(signIn.deleteUser).toHaveBeenCalledWith(created);
    signIn.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "email_exists", status: 422 } });
    const taken = await POST(request("POST", account));
    expect(taken.status).toBe(409);
    expect((await taken.json()).fields.email).toBeTruthy();
  });
  it("validates input and same-origin writes", async () => {
    expect((await POST(request("POST", { ...account, password: "short" }))).status).toBe(422);
    expect((await POST(request("POST", { ...account, role: "owner" }))).status).toBe(422);
    expect((await PATCH(request("PATCH", { ...profile, email: "x@y.z" }), context())).status).toBe(422);
    expect((await PATCH(request("PATCH", profile, "https://evil.example"), context())).status).toBe(403);
    expect((await PATCH(request("PATCH", profile), context("not-a-uuid"))).status).toBe(400);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("changes a profile and its access, but never the caller's own superadmin access or account", async () => {
    expect((await PATCH(request("PATCH", profile), context())).status).toBe(200);
    expect(repo.save).toHaveBeenCalledWith(other, profile);
    expect((await PATCH(request("PATCH", profile), context(me))).status).toBe(422);
    expect((await PATCH(request("PATCH", { ...profile, role: "admin", active: true }), context(me))).status).toBe(200);
    expect((await DELETE(request("DELETE"), context(me))).status).toBe(422);
  });
  it("sets passwords and deletes the profile and then the sign-in", async () => {
    expect((await PASSWORD(request("POST", { password: "fictional-pass-2" }), context())).status).toBe(200);
    expect(signIn.updateUserById).toHaveBeenCalledWith(other, { password: "fictional-pass-2" });
    const removed = await DELETE(request("DELETE"), context());
    expect(await removed.json()).toEqual({ deleted: true, id: other, signInRemoved: true });
    expect(repo.remove).toHaveBeenCalledWith(other);
    expect(signIn.deleteUser).toHaveBeenCalledWith(other);
  });
  it("without the service role key, still edits profiles but refuses sign-in changes", async () => {
    mocks.admin.mockReturnValue(null);
    expect((await POST(request("POST", account))).status).toBe(503);
    expect((await PASSWORD(request("POST", { password: "fictional-pass-2" }), context())).status).toBe(503);
    expect((await PATCH(request("PATCH", profile), context())).status).toBe(200);
    expect(await (await DELETE(request("DELETE"), context())).json()).toMatchObject({ signInRemoved: false });
  });
});
