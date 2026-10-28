// Fictional demo records owned and created by the named staff from seed:accounts, so lists, owner filters, the
// overview queue and the workload reports show real spread across the team. Contributions are left out on
// purpose: they are permanent. Dates are relative to the run day in Asia/Dhaka.
import type { Tables, TablesInsert } from "../../src/types/database.types";
import { activitySchema } from "../../src/features/activities/schemas";
import { contactSchema } from "../../src/features/contacts/schemas";
import { meetingSchema } from "../../src/features/meetings/schemas";
import { opportunitySchema } from "../../src/features/opportunities/schemas";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "../../src/lib/dates";
import { DEMO_MARKER } from "./demo-data";

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const teamIds = {
  contacts: Array.from({ length: 9 }, (_, i) => id("d6000000", i + 1)),
  deals: Array.from({ length: 8 }, (_, i) => id("d7000000", i + 1)),
  meetings: Array.from({ length: 6 }, (_, i) => id("d8000000", i + 1)),
  activities: Array.from({ length: 12 }, (_, i) => id("d9000000", i + 1)),
};
export const teamNames = ["JAC", "Tanvir Hasan", "Nusrat Jahan", "Arif Chowdhury", "Sadia Islam"] as const;
type Staff = Record<(typeof teamNames)[number], string>;
type Stage = Pick<Tables<"pipeline_stages">, "id" | "name" | "active">;
type Category = Pick<Tables<"contribution_categories">, "id" | "code" | "active">;

// Contacts by index (1-based), owner by first name.
const contactSpecs = [
  {
    kind: "company",
    name: "Meghna Pharmaceuticals",
    slug: "meghna",
    industry: "Pharmaceuticals",
    by: "JAC",
  },
  { kind: "company", name: "Padma Logistics", slug: "padma", industry: "Logistics", by: "Tanvir Hasan" },
  { kind: "company", name: "Sundarban Bank", slug: "sundarban", industry: "Banking", by: "JAC" },
  {
    kind: "individual",
    name: "Laila Haque",
    slug: "laila",
    company: 1,
    designation: "Head of CSR",
    by: "JAC",
  },
  {
    kind: "individual",
    name: "Mahmud Karim",
    slug: "mahmud",
    company: 1,
    designation: "Finance manager",
    by: "Nusrat Jahan",
  },
  {
    kind: "individual",
    name: "Rumana Akter",
    slug: "rumana",
    company: 2,
    designation: "Sustainability lead",
    by: "Tanvir Hasan",
  },
  {
    kind: "individual",
    name: "Jahid Hossain",
    slug: "jahid",
    company: 3,
    designation: "CSR officer",
    by: "Arif Chowdhury",
  },
  { kind: "individual", name: "Independent donor C", slug: "donor-c", by: "Sadia Islam" },
  { kind: "individual", name: "Independent donor D", slug: "donor-d", by: "Nusrat Jahan" },
] as const;

const dealSpecs = [
  {
    name: "Health camp sponsorship",
    party: 1,
    primary: 4,
    secondary: 5,
    stage: "Scoping",
    category: "PROJECT",
    amount: 220000,
    days: 35,
    by: "JAC",
  },
  {
    name: "Mobile library vans",
    party: 2,
    primary: 6,
    stage: "Preparation",
    category: "DSP",
    amount: 175000,
    days: 50,
    by: "Tanvir Hasan",
    inKind: true,
  },
  {
    name: "Scholarship fund",
    party: 3,
    primary: 7,
    stage: "Submitted",
    category: "GENERAL",
    amount: 500000,
    days: 20,
    by: "Arif Chowdhury",
  },
  {
    name: "Winter relief drive",
    party: 2,
    primary: 6,
    stage: "New",
    category: "DISASTER",
    amount: 90000,
    days: 40,
    by: "Sadia Islam",
  },
  {
    name: "Monthly child sponsorship",
    party: 8,
    stage: "Pending",
    category: "SAC",
    amount: 36000,
    days: 10,
    by: "Sadia Islam",
    monthly: true,
  },
  {
    name: "Employee giving programme",
    party: 3,
    primary: 7,
    stage: "Won",
    category: "EVENT_CAMPAIGN",
    amount: 120000,
    days: -5,
    by: "Tanvir Hasan",
  },
  {
    name: "School meal partnership",
    party: 1,
    primary: 4,
    stage: "Lost",
    category: "PROJECT",
    amount: 300000,
    days: -12,
    by: "Nusrat Jahan",
  },
  {
    name: "Annual gala table",
    party: 9,
    stage: "New",
    category: "EVENT_CAMPAIGN",
    amount: 25000,
    days: 60,
    by: "Nusrat Jahan",
  },
] as const;

// A meeting links its deal and (optionally) one of the deal's people, or a contact alone.
const meetingSpecs = [
  {
    title: "Health camp site visit",
    deal: 1,
    contact: 4,
    days: 2,
    time: "10:00",
    status: "scheduled",
    by: "JAC",
  },
  { title: "Library van handover planning", deal: 2, days: 6, time: "11:30", status: "scheduled", by: "Tanvir Hasan" },
  {
    title: "Scholarship committee briefing",
    deal: 3,
    contact: 7,
    days: -3,
    time: "15:00",
    status: "done",
    by: "Arif Chowdhury",
  },
  { title: "Donor welcome call", contact: 8, days: -6, time: "12:00", status: "done", by: "Sadia Islam" },
  {
    title: "Gala seating review",
    deal: 8,
    contact: 9,
    days: 9,
    time: "17:00",
    status: "scheduled",
    by: "Nusrat Jahan",
  },
  {
    title: "Winter drive kickoff",
    deal: 4,
    contact: 6,
    days: -1,
    time: "10:00",
    status: "cancelled",
    by: "Sadia Islam",
  },
] as const;

type ActivitySpec = {
  type: string;
  category: string;
  status: string;
  by: (typeof teamNames)[number];
  days: number;
  notes: string;
  contact?: number;
  deal?: number;
  meeting?: number;
  person?: string;
  organization?: string;
  remaining?: string;
};
const activitySpecs: ActivitySpec[] = [
  {
    type: "call",
    category: "prospect_engagement",
    status: "done",
    by: "JAC",
    contact: 4,
    deal: 1,
    days: -4,
    notes: "Introductory call\nIntroduced the health camp proposal and agreed a site visit.",
  },
  {
    type: "proposal",
    category: "prospect_engagement",
    status: "in_progress",
    by: "JAC",
    deal: 1,
    days: 1,
    notes: "Health camp proposal\nDrafting the proposal with the programme team.",
    remaining: "Finalise the budget annex.",
  },
  {
    type: "email",
    category: "prospect_engagement",
    status: "done",
    by: "Tanvir Hasan",
    contact: 6,
    deal: 2,
    days: -2,
    notes: "Van specification email\nShared the library van specification for the in-kind valuation.",
  },
  {
    type: "visit",
    category: "stewardship",
    status: "open",
    by: "Tanvir Hasan",
    contact: 2,
    days: 8,
    notes: "School visit with Padma Logistics volunteers\nShow the volunteers the classrooms their vans will serve.",
  },
  {
    type: "meeting",
    category: "prospect_engagement",
    status: "done",
    by: "Arif Chowdhury",
    meeting: 3,
    deal: 3,
    contact: 7,
    days: -3,
    notes: "Committee briefing notes\nThe bank asked for last year's scholarship outcomes.",
    remaining: "Send the outcomes report.",
  },
  {
    type: "task",
    category: "independent_general",
    status: "open",
    by: "Arif Chowdhury",
    organization: "Fictional Primary School",
    days: 3,
    notes: "Collect scholarship applications\nGather the shortlisted students' applications.",
  },
  {
    type: "stewardship",
    category: "stewardship",
    status: "done",
    by: "Sadia Islam",
    contact: 8,
    deal: 5,
    days: -6,
    notes: "Welcome pack\nSent the child sponsorship welcome pack and first progress note.",
  },
  {
    type: "campaign",
    category: "prospect_engagement",
    status: "open",
    by: "Sadia Islam",
    deal: 4,
    days: 12,
    notes: "Winter drive posts\nPlan the winter relief drive's social posts with Padma Logistics.",
    remaining: "Agree the posting calendar.",
  },
  {
    type: "event",
    category: "independent_general",
    status: "done",
    by: "Nusrat Jahan",
    organization: "JAAGO school fair",
    days: -9,
    notes: "School fair stall\nRan the PSE stall at the school fair.",
  },
  {
    type: "general",
    category: "independent_general",
    status: "cancelled",
    by: "Nusrat Jahan",
    person: "Fictional volunteer",
    days: -1,
    notes: "Volunteer orientation\nCancelled; the volunteer rescheduled.",
  },
  {
    type: "call",
    category: "stewardship",
    status: "done",
    by: "Tanvir Hasan",
    contact: 7,
    deal: 6,
    days: -5,
    notes: "Thank-you call\nThanked Sundarban Bank for the employee giving pledge.",
  },
  {
    type: "task",
    category: "prospect_engagement",
    status: "open",
    by: "JAC",
    contact: 5,
    deal: 1,
    days: 2,
    notes: "Cost breakdown\nSend the finance manager the health camp cost breakdown.",
  },
];

export function buildTeamData(staff: Staff, stages: Stage[], categories: Category[], now = new Date()) {
  const base = toDhakaDateTimeInput(now.toISOString()).slice(0, 10);
  const day = (offset: number) => {
    const value = new Date(`${base}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const at = (offset: number, time = "10:00") => fromDhakaDateTimeInput(`${day(offset)}T${time}`);
  const stage = (name: string) => {
    const row = stages.find(s => s.active && s.name === name);
    if (!row) throw new Error(`The active pipeline stage "${name}" is missing; add or activate it in Settings.`);
    return row.id;
  };
  const category = (code: string) => {
    const row = categories.find(c => c.active && c.code === code);
    if (!row) throw new Error(`The active contribution category ${code} is missing; add or activate it in Settings.`);
    return row.id;
  };
  const contactId = (n: number) => teamIds.contacts[n - 1];
  const dealId = (n: number) => teamIds.deals[n - 1];
  // NANPA reserves 555-0100..0199 for fictitious numbers; the earlier demo seed uses 0101-0111.
  const contacts: TablesInsert<"contacts">[] = contactSpecs.map((c, i) => {
    const row = {
      kind: c.kind,
      name: `Demo | ${c.name}`,
      email: `pse-team-${c.slug}@example.invalid`,
      phone: `+1 202 555 ${String(150 + i).padStart(4, "0")}`,
      company_id: "company" in c ? contactId(c.company) : "",
      designation: "designation" in c ? c.designation : "",
      website: c.kind === "company" ? `https://${c.slug}.example.invalid` : "",
      industry: "industry" in c ? c.industry : "",
      notes: `${DEMO_MARKER}. Owned by the named demo staff; details are examples only.`,
    };
    contactSchema.parse(row);
    return {
      ...row,
      company_id: row.company_id || null,
      designation: row.designation || null,
      website: row.website || null,
      industry: row.industry || null,
      id: contactId(i + 1),
      created_by: staff[c.by],
    };
  });
  const deals: TablesInsert<"opportunities">[] = dealSpecs.map((d, i) => {
    const values = {
      deal_name: `Demo | ${d.name}`,
      contact_id: contactId(d.party),
      primary_contact_id: "primary" in d ? contactId(d.primary) : "",
      secondary_contact_id: "secondary" in d ? contactId(d.secondary) : "",
      owner_id: staff[d.by],
      stage_id: stage(d.stage),
      contribution_type: "inKind" in d ? ("valued_in_kind" as const) : ("cash" as const),
      contribution_category_id: category(d.category),
      expected_amount: String(d.amount),
      currency: "BDT",
      payment_interval: "monthly" in d ? "monthly" : "once",
      expected_close_at: day(d.days),
      country: "Bangladesh",
      description: `${DEMO_MARKER}. Sample opportunity owned by ${d.by}.`,
      valuation_note:
        "inKind" in d
          ? "Fictional operational-team estimate: PSE agreed an expected value of BDT 175,000 for two refitted vans."
          : "",
    };
    opportunitySchema.parse(values);
    return {
      ...values,
      id: dealId(i + 1),
      created_by: staff[d.by],
      expected_amount: d.amount,
      primary_contact_id: values.primary_contact_id || null,
      secondary_contact_id: values.secondary_contact_id || null,
      valuation_note: values.valuation_note || null,
    };
  });
  const meetings: TablesInsert<"meetings">[] = meetingSpecs.map((m, i) => {
    const values = {
      title: `Demo | ${m.title}`,
      scheduled_at: at(m.days, m.time),
      status: m.status,
      owner_id: staff[m.by],
      contact_id: "contact" in m ? contactId(m.contact) : "",
      opportunity_id: "deal" in m ? dealId(m.deal) : "",
      description: `${DEMO_MARKER}. Sample meeting owned by ${m.by}.`,
    };
    meetingSchema.parse(values);
    return {
      ...values,
      id: teamIds.meetings[i],
      created_by: staff[m.by],
      contact_id: values.contact_id || null,
      opportunity_id: values.opportunity_id || null,
    };
  });
  const activities: TablesInsert<"activities">[] = activitySpecs.map((a, i) => {
    const values = {
      activity_type: a.type,
      work_category: a.category,
      status: a.status,
      owner_id: staff[a.by],
      contact_id: a.contact ? contactId(a.contact) : "",
      opportunity_id: a.deal ? dealId(a.deal) : "",
      meeting_id: a.meeting ? teamIds.meetings[a.meeting - 1] : "",
      related_person_name: a.person ?? "",
      related_organization_name: a.organization ?? "",
      remaining_work: a.remaining ?? "",
      occurred_at: at(a.days),
      notes: `${a.notes}\n\n${DEMO_MARKER}.`,
    };
    activitySchema.parse(values);
    return {
      ...values,
      id: teamIds.activities[i],
      created_by: staff[a.by],
      contact_id: values.contact_id || null,
      opportunity_id: values.opportunity_id || null,
      meeting_id: values.meeting_id || null,
      related_person_name: values.related_person_name || null,
      related_organization_name: values.related_organization_name || null,
      remaining_work: values.remaining_work || null,
    };
  });
  return {
    companies: contacts.filter(c => c.kind === "company"),
    people: contacts.filter(c => c.kind === "individual"),
    deals,
    meetings,
    activities,
  };
}
