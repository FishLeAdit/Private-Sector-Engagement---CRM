import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  client: vi.fn(),
  repo: vi.fn(),
  revalidate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("../../src/lib/cache/invalidation", () => ({ invalidateReportCache: mocks.invalidate }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/contributions/queries", () => ({ createContributionRepository: mocks.repo }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { POST as CORRECT } from "../../src/app/api/contributions/[id]/corrections/route";
const id = "f1000000-0000-4000-8000-000000000001",
  request_id = "f1000000-0000-4000-8000-000000000009",
  manager = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002";
const original = { id, amount: 100, currency: "BDT", corrects_contribution_id: null, recorded_by: member };
let repo: Record<"contribution" | "corrections" | "correct", ReturnType<typeof vi.fn>>;
let role: string;
beforeEach(() => {
  vi.clearAllMocks();
  role = "pse_manager";
  mocks.authorize.mockImplementation(async ({ manager: needsManager = false } = {}) =>
    needsManager && role === "pse_member"
      ? { ok: false, response: NextResponse.json({ error: "Denied" }, { status: 403 }) }
      : {
          ok: true,
          access: {
            status: "allowed",
            userId: manager,
            profile: { id: manager, display_name: "Fictional Manager", department: "PSE", role, active: true },
          },
        },
  );
  repo = {
    contribution: vi.fn().mockResolvedValue(original),
    corrections: vi.fn().mockResolvedValue([]),
    correct: vi.fn().mockResolvedValue({ id: request_id, amount: -40, corrects_contribution_id: id }),
  };
  mocks.repo.mockReturnValue(repo);
});
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const post = (body: unknown, origin = "http://localhost") =>
  new Request(`http://localhost/api/contributions/${id}/corrections`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { request_id, amount: "40", reason: "Fictional refund" };

describe("contribution correction API", () => {
  it("records a manager's correction and expires reports and finance pages", async () => {
    const response = await CORRECT(post(valid), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ contribution: expect.objectContaining({ id: request_id }) });
    expect(repo.correct).toHaveBeenCalledWith(id, valid, manager);
    expect(mocks.invalidate).toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/contributions", "layout");
  });
  it("denies members before reading the receipt", async () => {
    role = "pse_member";
    expect((await CORRECT(post(valid), context())).status).toBe(403);
    expect(repo.contribution).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes, bad IDs and invalid input", async () => {
    expect((await CORRECT(post(valid, "https://evil.example"), context())).status).toBe(403);
    expect((await CORRECT(post(valid), context("not-a-uuid"))).status).toBe(400);
    expect((await CORRECT(post({ ...valid, amount: "-1" }), context())).status).toBe(422);
    expect((await CORRECT(post({ ...valid, reason: " " }), context())).status).toBe(422);
    expect(repo.correct).not.toHaveBeenCalled();
  });
  it("refuses a missing receipt, a correction of a correction and an amount above what is left", async () => {
    repo.contribution.mockResolvedValueOnce(null);
    expect((await CORRECT(post(valid), context())).status).toBe(404);
    repo.contribution.mockResolvedValueOnce({ ...original, corrects_contribution_id: request_id });
    expect((await CORRECT(post(valid), context())).status).toBe(422);
    repo.corrections.mockResolvedValueOnce([{ id: "f1000000-0000-4000-8000-000000000002", amount: -70 }]);
    const response = await CORRECT(post(valid), context());
    expect(response.status).toBe(422);
    expect((await response.json()).fields.amount[0]).toContain("BDT 30.00");
    expect(repo.correct).not.toHaveBeenCalled();
  });
  it("does not count a retried submission against itself", async () => {
    repo.corrections.mockResolvedValueOnce([
      { id: request_id, amount: -40 },
      { id: "x", amount: -60 },
    ]);
    expect((await CORRECT(post(valid), context())).status).toBe(200);
  });
});
