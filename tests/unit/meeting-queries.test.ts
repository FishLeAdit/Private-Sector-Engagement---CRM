import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
vi.mock("server-only", () => ({}));
import { createMeetingRepository } from "../../src/features/meetings/queries";
import { meetingListSchema } from "../../src/features/meetings/schemas";

function repository(body: unknown = [], status = 200) {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
      }),
  );
  const client = createClient<Database>("https://example.supabase.co", "sb_publishable_fictional", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { fetcher, repo: createMeetingRepository(client) };
}
const id = "30000000-0000-4000-8000-000000000099",
  userId = "00000000-0000-4000-8000-000000000002";
const contactId = "10000000-0000-4000-8000-000000000002",
  opportunityId = "20000000-0000-4000-8000-000000000001";
const now = "2026-10-26T12:00:00.000Z";
const write = {
  title: "Fictional SDK meeting",
  owner_id: userId,
  contact_id: contactId,
  opportunity_id: null,
  scheduled_at: now,
  status: "scheduled",
  description: "Fictional context",
};

describe("Supabase meeting query contracts", () => {
  it("deletes only one requested ID and verifies an affected row", async () => {
    const { repo, fetcher } = repository({ id });
    expect(await repo.remove(id)).toBe(true);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(url.searchParams.get("select")).toBe("id");
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
    expect(await repository(null).repo.remove(id)).toBe(false);
  });
  it.each(["23503", "23001"])("scrubs delete reference conflict %s and returns 409", async code => {
    const error = await repository({ code, message: "Sensitive constraint details" }, 409)
      .repo.remove(id)
      .catch(error => error);
    expect(error.status).toBe(409);
    expect(error.message).toContain("follow-up tasks");
    expect(error.message).not.toContain("Sensitive");
  });
  it("uses bounded deterministic pagination, safe literal search and relationship filters", async () => {
    const { repo, fetcher } = repository(),
      q = 'Fictional, "quote"_%';
    await repo.list(
      meetingListSchema.parse({
        q,
        page: 2,
        owner_id: userId,
        contact_id: contactId,
        opportunity_id: opportunityId,
        status: "scheduled",
      }),
      now,
    );
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("order")).toMatch(/^scheduled_at\.(asc|desc),id\.asc$/);
    expect(url.searchParams.get("owner_id")).toBe(`eq.${userId}`);
    expect(url.searchParams.get("contact_id")).toBe(`eq.${contactId}`);
    expect(url.searchParams.get("opportunity_id")).toBe(`eq.${opportunityId}`);
    expect(url.searchParams.get("title")).toBe(`ilike.%${q.replace(/[\\%_]/g, character => `\\${character}`)}%`);
    expect(url.searchParams.get("select")).toContain("contact:contact_id");
    expect(url.searchParams.get("select")).toContain("opportunity:opportunity_id");
  });
  it("treats selected dates as whole Dhaka days using an exclusive next-day bound", async () => {
    const { repo, fetcher } = repository();
    await repo.list(meetingListSchema.parse({ from: "2026-10-26", to: "2026-10-26" }), now);
    const filters = new URL(fetcher.mock.calls[0][0]).searchParams.getAll("scheduled_at");
    const lower = filters.find(value => value.startsWith("gte.")),
      upper = filters.find(value => value.startsWith("lt."));
    expect(new Date(lower!.slice(4)).toISOString()).toBe("2026-10-25T18:00:00.000Z");
    expect(new Date(upper!.slice(3)).toISOString()).toBe("2026-10-26T18:00:00.000Z");
  });
  it("limits upcoming to scheduled future meetings and completed to done meetings", async () => {
    const { repo, fetcher } = repository();
    await repo.list(meetingListSchema.parse({ period: "upcoming" }), now);
    const upcoming = new URL(fetcher.mock.calls[0][0]);
    expect(upcoming.searchParams.get("status")).toBe("eq.scheduled");
    expect(upcoming.searchParams.getAll("scheduled_at")).toContain(`gte.${now}`);
    await repo.list(meetingListSchema.parse({ period: "completed" }), now);
    const completed = new URL(fetcher.mock.calls[1][0]);
    expect(completed.searchParams.get("status")).toBe("eq.done");
    expect(completed.searchParams.get("scheduled_at")).toBeNull();
  });
  it("loads internal contact designation/company and designated opportunity contact people", async () => {
    const { repo, fetcher } = repository(null);
    await repo.contact(contactId);
    await repo.opportunity(opportunityId);
    const contact = new URL(fetcher.mock.calls[0][0]),
      opportunity = new URL(fetcher.mock.calls[1][0]);
    expect(contact.searchParams.get("id")).toBe(`eq.${contactId}`);
    expect(contact.searchParams.get("select")).toContain("designation");
    expect(contact.searchParams.get("select")).toContain("company:");
    expect(opportunity.searchParams.get("id")).toBe(`eq.${opportunityId}`);
    expect(opportunity.searchParams.get("select")).toContain("primary_contact:primary_contact_id");
    expect(opportunity.searchParams.get("select")).toContain("secondary_contact:secondary_contact_id");
  });
  it("keeps inactive historical PSE owners available without querying non-PSE roles", async () => {
    const { repo, fetcher } = repository();
    await repo.owners();
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("department")).toBe("eq.PSE");
    expect(url.searchParams.get("role")).toContain("pse_member");
    expect(url.searchParams.get("active")).toBeNull();
    expect(url.searchParams.get("limit")).toBe("1000");
  });
  it("bounds linked activity/audit histories to the requested meeting", async () => {
    const { repo, fetcher } = repository();
    await repo.history(id);
    const urls = fetcher.mock.calls.map(([url]) => new URL(url));
    const activities = urls.find(url => url.pathname.endsWith("/activities"))!,
      audits = urls.find(url => url.pathname.endsWith("/audit_logs"))!;
    expect(activities.searchParams.get("meeting_id")).toBe(`eq.${id}`);
    expect(activities.searchParams.get("limit")).toBe("20");
    expect(audits.searchParams.get("entity")).toBe("eq.meetings");
    expect(audits.searchParams.get("entity_id")).toBe(`eq.${id}`);
    expect(audits.searchParams.get("limit")).toBe("20");
  });
  it("binds the creator on insert and scopes edits to one meeting", async () => {
    const { repo, fetcher } = repository({ id });
    await repo.create(write, userId);
    await repo.update(id, { ...write, status: "done" });
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ ...write, created_by: userId });
    expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("id")).toBe(`eq.${id}`);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).not.toHaveProperty("created_by");
    expect(await repository(null).repo.update(id, write)).toBeNull();
  });
  it("creates follow-ups in activities without writing financial tables", async () => {
    const { repo, fetcher } = repository({ id });
    await repo.createFollowUp(
      {
        activity_type: "task",
        work_category: "independent_general",
        meeting_id: id,
        contact_id: contactId,
        opportunity_id: opportunityId,
        owner_id: userId,
        status: "open",
        notes: "Fictional next action",
        occurred_at: null,
      },
      userId,
    );
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.pathname).toBe("/rest/v1/activities");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      activity_type: "task",
      status: "open",
      meeting_id: id,
      owner_id: userId,
      created_by: userId,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["42501", 403],
    ["23514", 422],
    ["23503", 422],
    ["XX000", 503],
  ])("scrubs provider error %s", async (code, status) => {
    const error = await repository({ code, message: "Sensitive database details" }, 400)
      .repo.find(id)
      .catch(error => error);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain("Sensitive");
  });
});
