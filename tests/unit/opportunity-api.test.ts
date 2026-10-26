import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { emptyOpportunity } from "../../src/features/opportunities/schemas";
import { OpportunityError } from "../../src/features/opportunities/types";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), repository: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/opportunities/queries", () => ({ createOpportunityRepository: mocks.repository }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { GET, POST } from "../../src/app/api/opportunities/route";
import { GET as GET_ONE, PATCH } from "../../src/app/api/opportunities/[id]/route";
import { GET as OPTIONS } from "../../src/app/api/opportunities/options/route";
import { POST as CONFIGURE } from "../../src/app/api/opportunities/configuration/route";

const id = "20000000-0000-4000-8000-000000000099", userId = "00000000-0000-4000-8000-000000000002";
const stage = "70000000-0000-4000-8000-000000000001", category = "80000000-0000-4000-8000-000000000001", contact = "10000000-0000-4000-8000-000000000004";
const body = { ...emptyOpportunity, deal_name: "Fictional API deal", contact_id: contact, owner_id: userId, stage_id: stage, contribution_category_id: category, expected_amount: "50.00" };
const record = { ...body, id, created_by: userId, contact: { id: contact, kind: "individual" }, expected_amount: 50, primary_contact_id: null, secondary_contact_id: null, operational_budget: null };
let repo: Record<"find" | "list" | "contact" | "options" | "create" | "update" | "history" | "saveStage" | "saveCategory", ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true, access: { status: "allowed", userId, profile: { id: userId, department: "PSE", role: "pse_member", active: true, display_name: "Fictional" } } });
  repo = { find: vi.fn().mockResolvedValue(record), list: vi.fn().mockResolvedValue({ opportunities: [record], count: 1 }), contact: vi.fn().mockResolvedValue(record.contact),
    options: vi.fn().mockResolvedValue({ stages: [{ id: stage, active: true }], categories: [{ id: category, active: true }], owners: [{ id: userId, active: true }] }),
    create: vi.fn().mockResolvedValue(record), update: vi.fn().mockResolvedValue(record), history: vi.fn().mockResolvedValue({ contributions: [], audits: [] }), saveStage: vi.fn(), saveCategory: vi.fn() };
  mocks.repository.mockReturnValue(repo);
});
function request(method: string, data: unknown, origin = "http://localhost") { return new Request("http://localhost/api/opportunities", { method, headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(data) }); }
const params = () => ({ params: Promise.resolve({ id }) });
describe("Opportunities HTTP API", () => {
  it("returns no-store paginated lists and configuration choices", async () => {
    const response = await GET(new Request("http://localhost/api/opportunities?page=2&currency=bdt"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, currency: "BDT" }));
    expect((await OPTIONS(new Request("http://localhost/api/opportunities/options"))).status).toBe(200);
  });
  it.each([401, 403, 503])("returns auth failure %s before accessing data", async status => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
    expect((await POST(request("POST", body))).status).toBe(status);
    expect((await PATCH(request("PATCH", { stage_id: stage }), params())).status).toBe(status);
    expect((await CONFIGURE(request("POST", { entity: "starter" }))).status).toBe(status); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and absent-origin writes", async () => {
    expect((await POST(request("POST", body, "https://evil.invalid"))).status).toBe(403);
    const missing = request("POST", body); missing.headers.delete("origin"); expect((await POST(missing)).status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("creates with verified identity and invalidates deal/contact views", async () => {
    expect((await POST(request("POST", body))).status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ expected_amount: 50, operational_budget: null }), userId);
    expect(mocks.revalidate).toHaveBeenCalledWith("/opportunities"); expect(mocks.revalidate).toHaveBeenCalledWith("/contacts", "layout");
  });
  it("rejects identity spoofing, zero value, invalid references and malformed filters", async () => {
    for (const extra of [{ expected_amount: "0" }, { created_by: userId }, { drive_urls: ["javascript:alert(1)"] }]) expect((await POST(request("POST", { ...body, ...extra }))).status).toBe(422);
    expect((await GET(new Request("http://localhost/api/opportunities?owner_id=invalid"))).status).toBe(422); expect(repo.create).not.toHaveBeenCalled();
  });
  it("handles JSON, content-type and size errors", async () => {
    expect((await POST(new Request("http://localhost/api/opportunities", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: "{" }))).status).toBe(400);
    const plain = request("POST", body); plain.headers.set("Content-Type", "text/plain"); expect((await POST(plain)).status).toBe(415);
    expect((await POST(request("POST", { notes: "x".repeat(65537) }))).status).toBe(413);
  });
  it("returns detail/history and safe 404/400 errors", async () => {
    expect((await GET_ONE(new Request(`http://localhost/api/opportunities/${id}`), params())).status).toBe(200);
    repo.find.mockResolvedValueOnce(null); expect((await GET_ONE(new Request(`http://localhost/api/opportunities/${id}`), params())).status).toBe(404);
    expect((await GET_ONE(new Request("http://localhost/api/opportunities/bad"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  });
  it("merges stage-only edits and denies colleagues or stale access", async () => {
    expect((await PATCH(request("PATCH", { stage_id: stage }), params())).status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(id, expect.objectContaining({ deal_name: body.deal_name, expected_amount: 50 }));
    repo.find.mockResolvedValueOnce({ ...record, owner_id: id, created_by: id }); expect((await PATCH(request("PATCH", { notes: "Forbidden" }), params())).status).toBe(403);
    repo.update.mockResolvedValueOnce(null); expect((await PATCH(request("PATCH", { notes: "Stale" }), params())).status).toBe(403);
  });
  it("allows only managers to configure stages and invalidates settings", async () => {
    const input = { entity: "stage", values: { name: "Fictional review", position: 10, outcome: "won", active: true, is_provisional: true } };
    expect((await CONFIGURE(request("POST", input))).status).toBe(403); expect(repo.saveStage).not.toHaveBeenCalled();
    const auth = await mocks.authorize(); auth.access.profile.role = "pse_manager";
    expect((await CONFIGURE(request("POST", input))).status).toBe(200);
    expect(repo.saveStage).toHaveBeenCalledWith(expect.objectContaining({ is_closed: true, outcome: "won" }), undefined); expect(mocks.revalidate).toHaveBeenCalledWith("/settings");
  });
  it("returns safe integrity failures and scrubs unexpected exceptions", async () => {
    repo.update.mockRejectedValueOnce(new OpportunityError(422, "Linked record conflict.")); expect((await PATCH(request("PATCH", { notes: "change" }), params())).status).toBe(422);
    repo.find.mockRejectedValueOnce(new Error("Sensitive provider internals"));
    const response = await GET_ONE(new Request(`http://localhost/api/opportunities/${id}`), params()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("Sensitive");
  });
});
