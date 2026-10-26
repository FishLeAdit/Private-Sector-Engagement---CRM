import { describe, expect, it, vi } from "vitest";
import type { AccessResult } from "../../src/lib/auth/session";
import type { MeetingContact, MeetingOpportunity, MeetingRecord, MeetingRepository } from "../../src/features/meetings/types";
vi.mock("server-only", () => ({}));
import { createMeetingsService } from "../../src/features/meetings/service";

const member = "00000000-0000-4000-8000-000000000002", colleague = "00000000-0000-4000-8000-000000000003";
const id = "30000000-0000-4000-8000-000000000099", contactId = "10000000-0000-4000-8000-000000000002", companyId = "10000000-0000-4000-8000-000000000001", opportunityId = "20000000-0000-4000-8000-000000000001";
const person: MeetingContact = { id: contactId, name: "Fictional meeting person", kind: "individual", email: "service-meeting@example.invalid", phone: null, website: null, designation: "Fictional coordinator", company_id: companyId, company: { id: companyId, name: "Fictional company" } };
const opportunity: MeetingOpportunity = { id: opportunityId, deal_name: "Fictional service opportunity", contact_id: companyId, primary_contact_id: contactId, secondary_contact_id: null, contact: { ...person, id: companyId, kind: "company", company_id: null, company: null }, primary_contact: person, secondary_contact: null };
const record: MeetingRecord = { id, title: "Fictional service meeting", contact_id: contactId, opportunity_id: opportunityId,
  scheduled_at: "2026-11-03T04:15:00.000Z", status: "done", description: "Fictional preserved description", owner_id: member, created_by: member,
  created_at: "2026-10-01T04:00:00Z", updated_at: "2026-10-01T04:00:00Z", contact: person, opportunity,
  owner: { id: member, display_name: "Fictional member" }, creator: { id: member, display_name: "Fictional member" } };
function access(): Extract<AccessResult, { status: "allowed" }> {
  return { status: "allowed", userId: member, profile: { id: member, display_name: "Fictional member", active: true, department: "PSE", role: "pse_member" } };
}
function repository(current: MeetingRecord = record) {
  return {
    list: vi.fn().mockResolvedValue({ meetings: [current], count: 1 }), find: vi.fn().mockResolvedValue(current),
    contact: vi.fn().mockResolvedValue(person), opportunity: vi.fn().mockResolvedValue(opportunity),
    owners: vi.fn().mockResolvedValue([{ id: member, display_name: "Fictional member", active: true }, { id: colleague, display_name: "Fictional colleague", active: true }]),
    create: vi.fn().mockResolvedValue(current), update: vi.fn().mockResolvedValue(current), remove: vi.fn().mockResolvedValue(true), history: vi.fn().mockResolvedValue({ activities: [], audits: [] }),
    createFollowUp: vi.fn().mockResolvedValue({ id: "40000000-0000-4000-8000-000000000099" }),
  } satisfies MeetingRepository;
}

describe("meeting deletion service", () => {
  it("allows the owner, retained creator and authorized manager", async () => {
    for (const [current, actor] of [[record, access()], [{ ...record, owner_id: colleague }, access()], [{ ...record, owner_id: colleague, created_by: colleague }, { status: "allowed", userId: member, profile: { id: member, display_name: "Fictional Manager", department: "PSE", role: "pse_manager", active: true } }]] as const) {
      const repo = repository(current); expect(await createMeetingsService(repo, actor).remove(id)).toEqual({ deleted: true, id }); expect(repo.remove).toHaveBeenCalledWith(id);
    }
  });
  it("blocks an unrelated colleague before deleting", async () => {
    const repo = repository({ ...record, owner_id: colleague, created_by: colleague }); await expect(createMeetingsService(repo, access()).remove(id)).rejects.toMatchObject({ status: 403 }); expect(repo.remove).not.toHaveBeenCalled();
  });
  it.each(["anonymous", "forbidden", "unavailable"] as const)("rejects %s deletion before reading", async status => {
    const repo = repository(); await expect(createMeetingsService(repo, { status }).remove(id)).rejects.toBeInstanceOf(Error); expect(repo.find).not.toHaveBeenCalled(); expect(repo.remove).not.toHaveBeenCalled();
  });
});

describe("Meetings service historical values and nullable link updates", () => {
  it("rejects identity/profile mismatch before any meeting or follow-up query", async () => {
    const repo = repository(), actor = access(); actor.profile.id = colleague;
    const service = createMeetingsService(repo, actor);
    await expect(service.get(id)).rejects.toMatchObject({ status: 403 });
    await expect(service.createFollowUp(id, { notes: "Fictional attempted follow-up" })).rejects.toMatchObject({ status: 403 });
    expect(repo.find).not.toHaveBeenCalled(); expect(repo.owners).not.toHaveBeenCalled(); expect(repo.createFollowUp).not.toHaveBeenCalled();
  });
  it("preserves an unchanged historical owner absent from active PSE choices", async () => {
    const historical = { ...record, owner_id: colleague, owner: null }, repo = repository(historical); repo.owners.mockResolvedValue([]);
    await createMeetingsService(repo, access()).update(id, { description: "Fictional historical correction" });
    expect(repo.update).toHaveBeenCalledWith(id, expect.objectContaining({ owner_id: colleague, description: "Fictional historical correction", status: "done", scheduled_at: record.scheduled_at }));
    expect(repo.owners).not.toHaveBeenCalled();
  });
  it("can explicitly clear description without resetting status, time or relationships", async () => {
    const repo = repository(); await createMeetingsService(repo, access()).update(id, { description: "" });
    expect(repo.update).toHaveBeenCalledWith(id, { title: record.title, contact_id: contactId, opportunity_id: opportunityId, scheduled_at: record.scheduled_at, status: "done", description: null, owner_id: member });
  });
  it("can clear either relationship while preserving the other, but rejects clearing both", async () => {
    const repo = repository(), service = createMeetingsService(repo, access());
    await service.update(id, { opportunity_id: "" }); expect(repo.update).toHaveBeenLastCalledWith(id, expect.objectContaining({ contact_id: contactId, opportunity_id: null }));
    await service.update(id, { contact_id: "" }); expect(repo.update).toHaveBeenLastCalledWith(id, expect.objectContaining({ contact_id: null, opportunity_id: opportunityId }));
    repo.update.mockClear();
    await expect(service.update(id, { contact_id: "", opportunity_id: "" })).rejects.toMatchObject({ status: 422, fields: { contact_id: expect.any(Array), opportunity_id: expect.any(Array) } });
    expect(repo.update).not.toHaveBeenCalled();
  });
  it.each(["contact_id", "opportunity_id"] as const)("rejects a stale %s while loading form selections", async field => {
    const repo = repository(); if (field === "contact_id") repo.contact.mockResolvedValue(null); else repo.opportunity.mockResolvedValue(null);
    await expect(createMeetingsService(repo, access()).options({ [field]: field === "contact_id" ? contactId : opportunityId })).rejects.toMatchObject({ status: 422, fields: { [field]: expect.any(Array) } });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("preserves an opportunity-only meeting's nullable contact on inherited follow-up writes", async () => {
    const repo = repository({ ...record, contact_id: null, contact: null, owner_id: colleague, created_by: colleague });
    await createMeetingsService(repo, access()).createFollowUp(id, { notes: "Fictional next action" });
    expect(repo.createFollowUp).toHaveBeenCalledWith({ activity_type: "task", work_category: "independent_general", status: "open", owner_id: member,
      meeting_id: id, contact_id: null, opportunity_id: opportunityId, notes: "Fictional next action", occurred_at: null }, member);
    expect(repo.contact).not.toHaveBeenCalled(); expect(repo.opportunity).not.toHaveBeenCalled();
  });
});
