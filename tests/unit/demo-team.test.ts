import { describe, expect, it } from "vitest";
import { buildTeamData, teamNames } from "../../scripts/lib/demo-team";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const staff = Object.fromEntries(teamNames.map((name, i) => [name, uuid(100 + i)])) as Record<
  (typeof teamNames)[number],
  string
>;
const stages = ["New", "Scoping", "Preparation", "Submitted", "Pending", "Won", "Lost"].map((name, i) => ({
  id: uuid(200 + i),
  name,
  active: true,
}));
const categories = ["DSP", "SAC", "DISASTER", "PROJECT", "EVENT_CAMPAIGN", "GENERAL"].map((code, i) => ({
  id: uuid(300 + i),
  code,
  active: true,
}));
const data = buildTeamData(staff, stages, categories, new Date("2026-10-28T06:00:00Z"));

describe("team demo seed", () => {
  it("spreads every record across the named staff, each owned and created by the same person", () => {
    const rows = [...data.companies, ...data.people, ...data.deals, ...data.meetings, ...data.activities];
    expect(rows).toHaveLength(35);
    expect(new Set(rows.map(row => row.created_by))).toEqual(new Set(Object.values(staff)));
    for (const row of [...data.deals, ...data.meetings, ...data.activities])
      expect((row as { owner_id: string }).owner_id).toBe(row.created_by);
  });
  it("links people to companies, and meetings and activities only to their deal's people", () => {
    const companies = new Set(data.companies.map(c => c.id));
    for (const person of data.people) if (person.company_id) expect(companies.has(person.company_id)).toBe(true);
    const people = (dealId: string) => {
      const deal = data.deals.find(d => d.id === dealId)!;
      return [deal.contact_id, deal.primary_contact_id, deal.secondary_contact_id];
    };
    for (const row of [...data.meetings, ...data.activities])
      if (row.opportunity_id && row.contact_id) expect(people(row.opportunity_id)).toContain(row.contact_id);
    const linked = data.activities.find(a => a.meeting_id)!;
    expect(data.meetings.find(m => m.id === linked.meeting_id)!.opportunity_id).toBe(linked.opportunity_id);
  });
  it("dates work around the run day in Asia/Dhaka and refuses a missing stage", () => {
    expect(data.deals[0].expected_close_at).toBe("2026-12-02");
    expect(data.meetings[0].scheduled_at).toBe("2026-10-30T04:00:00.000Z"); // 10:00 in Dhaka
    expect(() => buildTeamData(staff, stages.slice(0, 2), categories)).toThrow(/Preparation/);
  });
});
