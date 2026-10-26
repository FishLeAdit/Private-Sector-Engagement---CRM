import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { MeetingError } from "../../src/features/meetings/types";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), repository: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/meetings/queries", () => ({ createMeetingRepository: mocks.repository }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { GET, POST } from "../../src/app/api/meetings/route";
import { GET as GET_ONE, PATCH, DELETE } from "../../src/app/api/meetings/[id]/route";
import { GET as OPTIONS } from "../../src/app/api/meetings/options/route";
import { POST as FOLLOW_UP } from "../../src/app/api/meetings/[id]/follow-ups/route";

const id = "30000000-0000-4000-8000-000000000099";
const userId = "00000000-0000-4000-8000-000000000002";
const colleague = "00000000-0000-4000-8000-000000000003";
const contactId = "10000000-0000-4000-8000-000000000002";
const companyId = "10000000-0000-4000-8000-000000000001";
const opportunityId = "20000000-0000-4000-8000-000000000001";
const contact = { id: contactId, name: "Fictional meeting person", kind: "individual", email: "meeting-person@example.invalid", phone: null, website: null, designation: "Demo coordinator", company_id: companyId, company: { id: companyId, name: "Fictional company" } };
const opportunity = { id: opportunityId, deal_name: "Fictional sponsorship", contact_id: companyId, primary_contact_id: contactId, secondary_contact_id: null, contact: { ...contact, id: companyId, kind: "company" }, primary_contact: contact, secondary_contact: null };
const body = { title: "Fictional meeting", owner_id: userId, contact_id: contactId, opportunity_id: "", scheduled_at: "2026-10-26T10:00:00+06:00", status: "scheduled", description: "Fictional meeting context" };
const record = { ...body, id, opportunity_id: null, scheduled_at: "2026-10-26T04:00:00.000Z", created_by: userId, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", contact, opportunity: null, owner: { id: userId, display_name: "Fictional member" } };
let repo: Record<"list" | "find" | "contact" | "opportunity" | "owners" | "create" | "update" | "remove" | "history" | "createFollowUp", ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true, access: { status: "allowed", userId, profile: { id: userId, department: "PSE", role: "pse_member", active: true, display_name: "Fictional member" } } });
  repo = {
    list: vi.fn().mockResolvedValue({ meetings: [record], count: 1 }), find: vi.fn().mockResolvedValue(record), contact: vi.fn().mockResolvedValue(contact), opportunity: vi.fn().mockResolvedValue(opportunity),
    owners: vi.fn().mockResolvedValue([{ id: userId, display_name: "Fictional member", active: true }, { id: colleague, display_name: "Fictional colleague", active: true }]),
    create: vi.fn().mockResolvedValue(record), update: vi.fn().mockResolvedValue(record), remove: vi.fn().mockResolvedValue(true), history: vi.fn().mockResolvedValue({ activities: [], audits: [] }), createFollowUp: vi.fn().mockResolvedValue({ id: "40000000-0000-4000-8000-000000000099" }),
  };
  mocks.repository.mockReturnValue(repo);
});
function request(method: string, data: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/meetings", { method, headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(data) });
}
const params = () => ({ params: Promise.resolve({ id }) });

describe("Meetings HTTP API", () => {
  it("deletes one meeting without a JSON body and invalidates related pages", async () => {
    const response = await DELETE(new Request(`http://localhost/api/meetings/${id}`, { method: "DELETE", headers: { Origin: "http://localhost" } }), params());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ deleted: true, id }); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(repo.remove).toHaveBeenCalledWith(id); expect(mocks.revalidate).toHaveBeenCalledWith("/meetings"); expect(mocks.revalidate).toHaveBeenCalledWith("/contacts", "layout"); expect(mocks.revalidate).toHaveBeenCalledWith("/opportunities", "layout");
  });
  it("requires a matching Origin for deletion", async () => {
    expect((await DELETE(request("DELETE", undefined, "https://evil.invalid"), params())).status).toBe(403);
    const missing = request("DELETE", undefined); missing.headers.delete("origin"); expect((await DELETE(missing, params())).status).toBe(403); expect(repo.remove).not.toHaveBeenCalled();
  });
  it("denies unrelated deletion and detects stale affected-row access", async () => {
    repo.find.mockResolvedValueOnce({ ...record, owner_id: colleague, created_by: colleague }); expect((await DELETE(request("DELETE", undefined), params())).status).toBe(403); expect(repo.remove).not.toHaveBeenCalled();
    repo.remove.mockResolvedValueOnce(false); expect((await DELETE(request("DELETE", undefined), params())).status).toBe(403);
  });
  it("returns safe linked-work conflicts and missing/invalid meeting IDs", async () => {
    repo.remove.mockRejectedValueOnce(new MeetingError(409, "Linked follow-up tasks prevent deletion.")); const response = await DELETE(request("DELETE", undefined), params()); expect(response.status).toBe(409); expect((await response.json()).error).toContain("follow-up");
    repo.find.mockResolvedValueOnce(null); expect((await DELETE(request("DELETE", undefined), params())).status).toBe(404);
    expect((await DELETE(request("DELETE", undefined), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  });
  it("returns a private paginated list with validated filters and a request clock", async () => {
    const response = await GET(new Request("http://localhost/api/meetings?page=2&period=upcoming&owner_id=" + userId));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, period: "upcoming", owner_id: userId }), expect.any(String));
  });
  it.each([401, 403, 503])("rejects auth state %s before accessing meeting data", async status => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
    expect((await GET(new Request("http://localhost/api/meetings"))).status).toBe(status);
    expect((await POST(request("POST", body))).status).toBe(status);
    expect((await PATCH(request("PATCH", { status: "done" }), params())).status).toBe(status);
    expect((await DELETE(request("DELETE", undefined), params())).status).toBe(status);
    expect((await FOLLOW_UP(request("POST", { notes: "Fictional follow-up" }), params())).status).toBe(status);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("requires matching Origin for meeting writes and follow-ups", async () => {
    expect((await POST(request("POST", body, "https://evil.invalid"))).status).toBe(403);
    const missing = request("PATCH", { status: "done" }); missing.headers.delete("origin");
    expect((await PATCH(missing, params())).status).toBe(403);
    expect((await FOLLOW_UP(request("POST", { notes: "Fictional" }, "https://evil.invalid"), params())).status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled(); expect(repo.update).not.toHaveBeenCalled(); expect(repo.createFollowUp).not.toHaveBeenCalled();
  });
  it("creates using the verified creator and normalizes the supplied offset to UTC", async () => {
    const response = await POST(request("POST", body)); expect(response.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: body.title, owner_id: userId, contact_id: contactId, opportunity_id: null, scheduled_at: "2026-10-26T04:00:00.000Z" }), userId);
    expect(mocks.revalidate).toHaveBeenCalledWith("/meetings"); expect(mocks.revalidate).toHaveBeenCalledWith("/contacts", "layout");
  });
  it("requires a valid relationship/time and rejects identity mass assignment", async () => {
    for (const extra of [{ contact_id: "", opportunity_id: "" }, { scheduled_at: "2026-10-26T10:00" }, { title: " " }, { created_by: colleague }]) {
      expect((await POST(request("POST", { ...body, ...extra }))).status).toBe(422);
    }
    expect(repo.create).not.toHaveBeenCalled();
    expect((await GET(new Request("http://localhost/api/meetings?owner_id=invalid"))).status).toBe(422);
  });
  it("checks that a selected contact is compatible with the linked opportunity", async () => {
    repo.opportunity.mockResolvedValueOnce({ ...opportunity, primary_contact_id: colleague, secondary_contact_id: null });
    expect((await POST(request("POST", { ...body, opportunity_id: opportunityId }))).status).toBe(422); expect(repo.create).not.toHaveBeenCalled();
  });
  it("validates malformed JSON, content type and request size", async () => {
    const invalid = new Request("http://localhost/api/meetings", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: "{" });
    expect((await POST(invalid)).status).toBe(400);
    const plain = request("POST", body); plain.headers.set("Content-Type", "text/plain"); expect((await POST(plain)).status).toBe(415);
    expect((await POST(request("POST", { description: "x".repeat(65537) }))).status).toBe(413);
  });
  it("loads details/history and rejects absent or malformed meeting IDs", async () => {
    const response = await GET_ONE(new Request(`http://localhost/api/meetings/${id}`), params());
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ meeting: { id }, history: { activities: [], audits: [] } });
    repo.find.mockResolvedValueOnce(null); expect((await GET_ONE(new Request(`http://localhost/api/meetings/${id}`), params())).status).toBe(404);
    expect((await GET_ONE(new Request("http://localhost/api/meetings/bad"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  });
  it("merges status-only updates without resetting relationship/time fields", async () => {
    expect((await PATCH(request("PATCH", { status: "done" }), params())).status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(id, expect.objectContaining({ title: body.title, status: "done", contact_id: contactId, scheduled_at: record.scheduled_at }));
    expect((await PATCH(request("PATCH", { created_by: colleague }), params())).status).toBe(422);
  });
  it("denies unrelated edits/reassignment and handles permissions revoked after the initial read", async () => {
    repo.find.mockResolvedValueOnce({ ...record, owner_id: colleague, created_by: colleague });
    expect((await PATCH(request("PATCH", { status: "done" }), params())).status).toBe(403); expect(repo.update).not.toHaveBeenCalled();
    expect((await PATCH(request("PATCH", { owner_id: colleague }), params())).status).toBe(403);
    repo.update.mockResolvedValueOnce(null); expect((await PATCH(request("PATCH", { status: "done" }), params())).status).toBe(403);
  });
  it("loads internal owner/contact/opportunity options with no-store headers", async () => {
    const response = await OPTIONS(new Request(`http://localhost/api/meetings/options?contact_id=${contactId}&opportunity_id=${opportunityId}`));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ contact: { id: contactId }, opportunity: { id: opportunityId } });
    expect((await OPTIONS(new Request("http://localhost/api/meetings/options?opportunity_id=bad"))).status).toBe(422);
  });
  it("creates an own follow-up on a colleague's meeting using inherited links", async () => {
    repo.find.mockResolvedValueOnce({ ...record, owner_id: colleague, created_by: colleague, opportunity_id: opportunityId });
    const response = await FOLLOW_UP(request("POST", { notes: " Fictional next action ", occurred_at: "2026-10-27T15:00:00+06:00" }), params());
    expect(response.status).toBe(201);
    expect(repo.createFollowUp).toHaveBeenCalledWith(expect.objectContaining({ activity_type: "task", status: "open", notes: "Fictional next action", meeting_id: id, contact_id: contactId, opportunity_id: opportunityId, owner_id: userId, occurred_at: "2026-10-27T09:00:00.000Z" }), userId);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/meetings/${id}`);
  });
  it("rejects empty/spoofed follow-ups and member assignment to another employee", async () => {
    for (const input of [{ notes: " " }, { notes: "Fictional", created_by: colleague }, { notes: "Fictional", contact_id: companyId }]) expect((await FOLLOW_UP(request("POST", input), params())).status).toBe(422);
    expect((await FOLLOW_UP(request("POST", { notes: "Fictional", owner_id: colleague }), params())).status).toBe(403);
    expect(repo.createFollowUp).not.toHaveBeenCalled();
  });
  it("allows manager assignment to active employees while rejecting inactive selections", async () => {
    const auth = await mocks.authorize(); auth.access.profile.role = "pse_manager";
    expect((await PATCH(request("PATCH", { owner_id: colleague }), params())).status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(id, expect.objectContaining({ owner_id: colleague }));
    expect((await FOLLOW_UP(request("POST", { notes: "Fictional assigned follow-up", owner_id: colleague }), params())).status).toBe(201);
    expect(repo.createFollowUp).toHaveBeenCalledWith(expect.objectContaining({ owner_id: colleague }), userId);
    repo.owners.mockResolvedValueOnce([{ id: colleague, display_name: "Fictional inactive", active: false }]);
    expect((await POST(request("POST", { ...body, owner_id: colleague }))).status).toBe(422);
  });
  it("never creates an orphan follow-up when the meeting is missing or its ID is invalid", async () => {
    repo.find.mockResolvedValueOnce(null);
    expect((await FOLLOW_UP(request("POST", { notes: "Fictional" }), params())).status).toBe(404);
    expect((await FOLLOW_UP(request("POST", { notes: "Fictional" }), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
    expect(repo.createFollowUp).not.toHaveBeenCalled();
  });
  it("returns safe integrity/provider errors without leaking implementation details", async () => {
    repo.update.mockRejectedValueOnce(new MeetingError(422, "Linked activity conflict.")); expect((await PATCH(request("PATCH", { description: "Fictional change" }), params())).status).toBe(422);
    repo.find.mockRejectedValueOnce(new Error("Sensitive provider details"));
    const response = await GET_ONE(new Request(`http://localhost/api/meetings/${id}`), params()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("Sensitive");
  });
});
