import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { ActivityError } from "../../src/features/activities/types";
import { activityTypes } from "../../src/features/activities/schemas";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), repository: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../src/lib/cache/invalidation", () => ({ invalidateReportCache: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/activities/queries", () => ({ createActivityRepository: mocks.repository }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { GET, POST } from "../../src/app/api/activities/route";
import { GET as DETAIL, PATCH, DELETE } from "../../src/app/api/activities/[id]/route";
import { GET as OPTIONS } from "../../src/app/api/activities/options/route";
const id = "40000000-0000-4000-8000-000000000099",
  member = "00000000-0000-4000-8000-000000000002",
  colleague = "00000000-0000-4000-8000-000000000003";
const contactId = "10000000-0000-4000-8000-000000000002",
  company = "10000000-0000-4000-8000-000000000001",
  opportunityId = "20000000-0000-4000-8000-000000000001",
  meetingId = "30000000-0000-4000-8000-000000000001";
const contact = { id: contactId },
  opportunity = { id: opportunityId, contact_id: company, primary_contact_id: contactId, secondary_contact_id: null };
const meeting = { id: meetingId, contact_id: contactId, opportunity_id: opportunityId, opportunity };
const body = {
  activity_type: "general",
  owner_id: member,
  notes: "Fictional independent context",
  related_organization_name: "Fictional PSE team",
};
const record = {
  ...body,
  id,
  created_by: member,
  status: "in_progress",
  work_category: "independent_general",
  contact_id: null,
  opportunity_id: null,
  meeting_id: null,
  occurred_at: null,
  drive_urls: ["https://drive.google.com/fictional-reference"],
  remaining_work: "Fictional pending task",
  related_person_name: "Fictional Person",
  related_organization_name: null,
  estimated_nonmonetary_value: 5000,
};
let repo: Record<
  "list" | "find" | "contact" | "opportunity" | "meeting" | "owners" | "create" | "update" | "remove" | "history",
  ReturnType<typeof vi.fn>
>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({
    ok: true,
    access: {
      status: "allowed",
      userId: member,
      profile: { id: member, department: "PSE", role: "pse_member", active: true, display_name: "Fictional Member" },
    },
  });
  repo = {
    list: vi.fn().mockResolvedValue({ activities: [record], count: 1 }),
    find: vi.fn().mockResolvedValue(record),
    contact: vi.fn().mockResolvedValue(contact),
    opportunity: vi.fn().mockResolvedValue(opportunity),
    meeting: vi.fn().mockResolvedValue(meeting),
    owners: vi.fn().mockResolvedValue([
      { id: member, active: true },
      { id: colleague, active: true },
    ]),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    remove: vi.fn().mockResolvedValue(true),
    history: vi.fn().mockResolvedValue([]),
  };
  mocks.repository.mockReturnValue(repo);
});
const params = () => ({ params: Promise.resolve({ id }) });
function request(method: string, data?: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/activities", {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
describe("Activities authenticated HTTP workflow", () => {
  it("rejects absent context on create and prevents clearing all context on update", async () => {
    expect((await POST(request("POST", { ...body, related_organization_name: "" }))).status).toBe(422);
    expect(
      (await PATCH(request("PATCH", { related_person_name: "", related_organization_name: "" }), params())).status,
    ).toBe(422);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])("rejects auth state %s before all data access", async status => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
    for (const response of [
      await GET(request("GET")),
      await DETAIL(request("GET"), params()),
      await OPTIONS(request("GET")),
      await POST(request("POST", body)),
      await PATCH(request("PATCH", { status: "done" }), params()),
      await DELETE(request("DELETE"), params()),
    ])
      expect(response.status).toBe(status);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("returns private bounded list filters and detail audit history", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/activities?page=2&activity_type=event&work_category=independent_general&from=2026-10-27",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, activity_type: "event", from: "2026-10-27" }),
    );
    expect(await (await DETAIL(request("GET"), params())).json()).toMatchObject({ activity: { id }, audits: [] });
  });
  it.each(activityTypes)(
    "creates independent %s without requiring a financial deal or any CRM link",
    async activity_type => {
      const response = await POST(request("POST", { ...body, activity_type }));
      expect(response.status).toBe(201);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type,
          contact_id: null,
          opportunity_id: null,
          meeting_id: null,
          occurred_at: null,
        }),
        member,
      );
      expect(repo.contact).not.toHaveBeenCalled();
      expect(repo.opportunity).not.toHaveBeenCalled();
      expect(repo.meeting).not.toHaveBeenCalled();
    },
  );
  it("normalizes Dhaka offsets, free context and HTTP(S) references", async () => {
    expect(
      (
        await POST(
          request("POST", {
            ...body,
            related_person_name: " Fictional person ",
            related_organization_name: " Fictional school ",
            occurred_at: "2026-10-27T10:30:00+06:00",
            drive_urls: ["https://drive.google.com/fictional", ""],
          }),
        )
      ).status,
    ).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        related_person_name: "Fictional person",
        occurred_at: "2026-10-27T04:30:00.000Z",
        drive_urls: ["https://drive.google.com/fictional"],
      }),
      member,
    );
  });
  it("merges status-only updates and excludes legacy estimates from writes", async () => {
    expect((await PATCH(request("PATCH", { status: "done" }), params())).status).toBe(200);
    const write = repo.update.mock.calls[0][1];
    expect(write).toMatchObject({
      notes: body.notes,
      status: "done",
      remaining_work: record.remaining_work,
      drive_urls: record.drive_urls,
      related_person_name: record.related_person_name,
    });
    expect(write).not.toHaveProperty("estimated_nonmonetary_value");
    expect(write).not.toHaveProperty("created_by");
  });
  it("can clear every optional link and relevant time", async () => {
    repo.find.mockResolvedValue({
      ...record,
      contact_id: contactId,
      opportunity_id: opportunityId,
      meeting_id: meetingId,
      occurred_at: "2026-10-27T04:00:00Z",
    });
    expect(
      (await PATCH(request("PATCH", { contact_id: "", opportunity_id: "", meeting_id: "", occurred_at: "" }), params()))
        .status,
    ).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ contact_id: null, opportunity_id: null, meeting_id: null, occurred_at: null }),
    );
  });
  it.each([
    { created_by: colleague },
    { estimated_nonmonetary_value: 100 },
    { amount: 100 },
    { id },
    { status: "invalid" },
    { notes: " " },
    { occurred_at: "2026-10-27T10:00" },
    { drive_urls: ["javascript:alert(1)"] },
  ])("rejects malformed or mass-assigned fields %j", async extra => {
    expect((await POST(request("POST", { ...body, ...extra }))).status).toBe(422);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("checks origin on every write", async () => {
    for (const origin of ["https://evil.invalid", ""]) {
      expect((await POST(request("POST", body, origin))).status).toBe(403);
      expect((await PATCH(request("PATCH", { status: "done" }, origin), params())).status).toBe(403);
      expect((await DELETE(request("DELETE", undefined, origin), params())).status).toBe(403);
    }
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("validates content type, JSON syntax and payload size", async () => {
    const plain = request("POST", body);
    plain.headers.set("content-type", "text/plain");
    expect((await POST(plain)).status).toBe(415);
    expect(
      (
        await POST(
          new Request("http://localhost/api/activities", {
            method: "POST",
            headers: { origin: "http://localhost", "content-type": "application/json" },
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(request("POST", { notes: "x".repeat(65537) }))).status).toBe(413);
  });
  it("requires compatible contact/opportunity/meeting combinations", async () => {
    expect(
      (
        await POST(
          request("POST", { ...body, contact_id: contactId, opportunity_id: opportunityId, meeting_id: meetingId }),
        )
      ).status,
    ).toBe(201);
    repo.opportunity.mockResolvedValueOnce({ ...opportunity, primary_contact_id: colleague });
    expect(
      (await POST(request("POST", { ...body, contact_id: contactId, opportunity_id: opportunityId }))).status,
    ).toBe(422);
    repo.meeting.mockResolvedValueOnce({ ...meeting, opportunity_id: colleague });
    expect(
      (await POST(request("POST", { ...body, meeting_id: meetingId, opportunity_id: opportunityId }))).status,
    ).toBe(422);
    repo.meeting.mockResolvedValueOnce({ ...meeting, opportunity_id: null, opportunity: null });
    repo.contact.mockResolvedValueOnce({ id: company });
    expect((await POST(request("POST", { ...body, meeting_id: meetingId, contact_id: company }))).status).toBe(422);
  });
  it("checks meeting-derived opportunity contacts and contact-only meetings paired with a deal", async () => {
    expect((await POST(request("POST", { ...body, meeting_id: meetingId, contact_id: contactId }))).status).toBe(201);
    repo.meeting.mockResolvedValueOnce({ ...meeting, contact_id: colleague, opportunity_id: null, opportunity: null });
    expect(
      (await POST(request("POST", { ...body, meeting_id: meetingId, opportunity_id: opportunityId }))).status,
    ).toBe(422);
  });
  it.each(["contact", "opportunity", "meeting"] as const)(
    "rejects a disappeared %s in options or writes",
    async field => {
      repo[field].mockResolvedValue(null);
      const link = {
        [`${field}_id`]: field === "contact" ? contactId : field === "opportunity" ? opportunityId : meetingId,
      };
      expect(
        (await OPTIONS(new Request("http://localhost/api/activities/options?" + new URLSearchParams(link)))).status,
      ).toBe(422);
      expect((await POST(request("POST", { ...body, ...link }))).status).toBe(422);
    },
  );
  it("keeps unchanged historical owners and limits reassignment to managers", async () => {
    repo.find.mockResolvedValueOnce({ ...record, owner_id: colleague });
    repo.owners.mockResolvedValue([]);
    expect((await PATCH(request("PATCH", { notes: "Historical correction" }), params())).status).toBe(200);
    expect(repo.owners).not.toHaveBeenCalled();
    expect((await PATCH(request("PATCH", { owner_id: colleague }), params())).status).toBe(403);
    const auth = await mocks.authorize();
    auth.access.profile.role = "pse_manager";
    repo.owners.mockResolvedValue([{ id: colleague, active: true }]);
    expect((await PATCH(request("PATCH", { owner_id: colleague }), params())).status).toBe(200);
    repo.owners.mockResolvedValue([{ id: colleague, active: false }]);
    expect((await POST(request("POST", { ...body, owner_id: colleague }))).status).toBe(422);
  });
  it("deletes as owner, retained creator or manager and invalidates related pages", async () => {
    for (const current of [record, { ...record, owner_id: colleague }]) {
      repo.find.mockResolvedValueOnce(current);
      expect((await DELETE(request("DELETE"), params())).status).toBe(200);
    }
    const auth = await mocks.authorize();
    auth.access.profile.role = "pse_manager";
    repo.find.mockResolvedValueOnce({ ...record, owner_id: colleague, created_by: colleague });
    expect((await DELETE(request("DELETE"), params())).status).toBe(200);
    expect(repo.remove).toHaveBeenCalledWith(id);
    for (const path of ["/contacts", "/opportunities", "/meetings"])
      expect(mocks.revalidate).toHaveBeenCalledWith(path, "layout");
  });
  it("blocks unrelated changes and detects write access revoked after read", async () => {
    for (const operation of [PATCH, DELETE]) {
      repo.find.mockResolvedValueOnce({ ...record, owner_id: colleague, created_by: colleague });
      expect(
        (
          await operation(
            request(operation === PATCH ? "PATCH" : "DELETE", operation === PATCH ? { status: "done" } : undefined),
            params(),
          )
        ).status,
      ).toBe(403);
    }
    expect(repo.remove).not.toHaveBeenCalled();
    repo.remove.mockResolvedValueOnce(false);
    expect((await DELETE(request("DELETE"), params())).status).toBe(403);
    repo.update.mockResolvedValueOnce(null);
    expect((await PATCH(request("PATCH", { status: "done" }), params())).status).toBe(403);
  });
  it("handles missing IDs, bad IDs, database failures and future linked-record conflicts safely", async () => {
    repo.find.mockResolvedValueOnce(null);
    expect((await DELETE(request("DELETE"), params())).status).toBe(404);
    expect((await DETAIL(request("GET"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
    repo.remove.mockRejectedValueOnce(new ActivityError(409, "Activity is referenced."));
    expect((await DELETE(request("DELETE"), params())).status).toBe(409);
    repo.list.mockRejectedValueOnce(new Error("Sensitive database details"));
    const response = await GET(request("GET"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("Sensitive");
  });
  it("rejects identity mismatch and invalid list filters", async () => {
    const auth = await mocks.authorize();
    auth.access.profile.id = colleague;
    expect((await GET(request("GET"))).status).toBe(403);
    expect(repo.list).not.toHaveBeenCalled();
    auth.access.profile.id = member;
    for (const query of ["page=0", "from=2026-10-29&to=2026-10-27", "q=*", "unknown=1"])
      expect((await GET(new Request("http://localhost/api/activities?" + query))).status).toBe(422);
  });
});
