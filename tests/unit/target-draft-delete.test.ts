import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  client: vi.fn(),
  repo: vi.fn(),
  invalidate: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/targets/queries", () => ({ createTargetRepository: mocks.repo }));
vi.mock("../../src/lib/cache/invalidation", () => ({ invalidateReportCache: mocks.invalidate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { DELETE } from "../../src/app/api/targets/[id]/route";

const id = "60000000-0000-4000-8000-000000000002",
  me = "00000000-0000-4000-8000-000000000001";
let role: string, repo: Record<"plan" | "removeDraft", ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  role = "admin";
  mocks.authorize.mockImplementation(async () => ({
    ok: true,
    access: {
      status: "allowed",
      userId: me,
      profile: { id: me, display_name: "F", department: "PSE", role, active: true },
    },
  }));
  repo = { plan: vi.fn().mockResolvedValue({ id, status: "draft" }), removeDraft: vi.fn() };
  mocks.repo.mockReturnValue(repo);
});
const remove = (origin = "http://localhost") =>
  DELETE(new Request(`http://localhost/api/targets/${id}`, { method: "DELETE", headers: { origin } }), {
    params: Promise.resolve({ id }),
  });

describe("draft target plan deletion", () => {
  it("lets a superadmin delete a draft and expires finance pages", async () => {
    const response = await remove();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, id });
    expect(repo.removeDraft).toHaveBeenCalledWith(id);
    expect(mocks.invalidate).toHaveBeenCalled();
  });
  it("refuses managers, approved plans and cross-origin requests", async () => {
    role = "pse_manager";
    expect((await remove()).status).toBe(403);
    role = "admin";
    repo.plan.mockResolvedValueOnce({ id, status: "approved" });
    expect((await remove()).status).toBe(409);
    expect((await remove("https://evil.example")).status).toBe(403);
    expect(repo.removeDraft).not.toHaveBeenCalled();
  });
});
