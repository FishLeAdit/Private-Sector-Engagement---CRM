import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), signIn: vi.fn(), revalidate: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../src/features/auth/service", () => ({ signInWithAccess: mocks.signIn }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));

import { signInAction, signOutAction } from "../../src/app/(auth)/actions";

function loginForm(next = "/dashboard") {
  const form = new FormData();
  form.set("email", " demo@example.invalid ");
  form.set("password", " fictional-password ");
  form.set("next", next);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });
  mocks.signIn.mockResolvedValue({ ok: true });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("authentication server actions", () => {
  it("validates submitted values on the server before calling Auth", async () => {
    const form = loginForm();
    form.set("email", "invalid");
    const result = await signInAction({ error: "" }, form);
    expect(result.error).toContain("valid email");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("preserves password whitespace and redirects only after verified access", async () => {
    await expect(signInAction({ error: "" }, loginForm("/contacts/new"))).rejects.toThrow("REDIRECT:/contacts/new");
    expect(mocks.signIn).toHaveBeenCalledWith(expect.anything(), "demo@example.invalid", " fictional-password ");
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("sanitizes manipulated hidden redirect fields", async () => {
    await expect(signInAction({ error: "" }, loginForm("//evil.invalid"))).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("returns a membership error without navigating or returning credentials", async () => {
    mocks.signIn.mockResolvedValueOnce({ ok: false, error: "PSE access required" });
    expect(await signInAction({ error: "" }, loginForm())).toEqual({ error: "PSE access required" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("signs out the current session, invalidates the layout and opens login", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("does not claim logout succeeded during an Auth failure", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: { message: "Provider failure" } });
    expect(await signOutAction()).toEqual({ error: "Unable to sign out. Please try again." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
