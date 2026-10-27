import type { Tables, TablesInsert } from "../../src/types/database.types";
import { activitySchema, activityTypes } from "../../src/features/activities/schemas";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "../../src/lib/dates";
export const demoActivityIds = Array.from({ length: 11 }, (_, index) => `d4000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
type Contact = Pick<Tables<"contacts">, "id" | "kind">;
type Opportunity = Pick<Tables<"opportunities">, "id" | "contact_id" | "primary_contact_id" | "secondary_contact_id">;
type Meeting = Pick<Tables<"meetings">, "id" | "contact_id" | "opportunity_id" | "status">;
export function buildDemoActivities(ownerId: string, contacts: Contact[], opportunities: Opportunity[], meetings: Meeting[], now = new Date()): TablesInsert<"activities">[] {
  const base = toDhakaDateTimeInput(now.toISOString()).slice(0, 10);
  const date = (offset: number) => { const day = new Date(`${base}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + offset); return fromDhakaDateTimeInput(`${day.toISOString().slice(0, 10)}T10:00`); };
  const person = contacts.find(row => row.kind === "individual") ?? contacts[0], opportunity = opportunities[0], meeting = meetings[0], doneMeeting = meetings.find(row => row.status === "done") ?? meeting;
  const personLink = person ? { contact_id: person.id } : {};
  const opportunityLink = opportunity ? { opportunity_id: opportunity.id } : {};
  const specs = [
    { notes: "Prepare meeting follow-up\nConfirm the next action and share the discussion summary.", links: meeting ? { meeting_id: meeting.id } : {}, status: "open", category: "prospect_engagement", remaining: "Send the fictional discussion summary.", days: 1 },
    { notes: "Thank-you email\nManually logged donor email; no Gmail synchronization.", links: personLink, status: "done", category: "stewardship", days: -1 },
    { notes: "Sponsorship clarification call\nDiscuss requirements without recording received funding.", links: opportunityLink, status: "in_progress", category: "prospect_engagement", remaining: "Confirm requirements with the designated contact.", days: 0 },
    { notes: "Record partnership conversation\nA work log linked to an existing meeting, without creating another meeting.", links: doneMeeting ? { meeting_id: doneMeeting.id } : {}, status: "done", category: "stewardship", days: -2 },
    { notes: "Community open day\nIndependent event preparation; no opportunity or budget is required.", organization: "Fictional Community Learning Centre", status: "open", category: "independent_general", remaining: "Prepare the guest list.", days: 4 },
    { notes: "Partner outreach campaign\nCoordinate outreach and record progress separately from financial achievement.", links: opportunityLink, status: "in_progress", category: "prospect_engagement", remaining: "Review the outreach draft.", days: 2 },
    { notes: "Prepare partnership proposal\nDraft the proposal and record submission progress here.", links: opportunityLink, status: "open", category: "prospect_engagement", remaining: "Complete the proposal draft.", days: 3 },
    { notes: "School visit rescheduled\nCancelled visit log retained for relationship context.", person: "Fictional Visit Coordinator", organization: "Fictional Riverside School", status: "cancelled", category: "independent_general", days: -3 },
    { notes: "Donor servicing check-in\nShare a programme update with an existing supporter.", links: personLink, status: "done", category: "stewardship", days: -4 },
    { notes: "Potential donor introduction\nIndependent relationship building before an opportunity exists.", person: "Fictional Outreach Lead", organization: "Fictional Community Foundation", status: "open", category: "prospect_engagement", remaining: "Arrange an introductory conversation.", days: 5 },
    { notes: "General inbox and small-gift coordination\nRecord an unvalued stationery offer and general correspondence without financial recognition.", status: "open", category: "independent_general", remaining: "Confirm collection arrangements." },
  ];
  return specs.map((spec, index) => {
    const data = activitySchema.parse({ activity_type: activityTypes[index], work_category: spec.category, status: spec.status, owner_id: ownerId, notes: `Demo | ${spec.notes}`, remaining_work: spec.remaining ?? "", related_person_name: spec.person ?? "", related_organization_name: spec.organization ?? (spec.links && Object.keys(spec.links).length ? "" : "Fictional PSE general-work team"), occurred_at: spec.days === undefined ? "" : date(spec.days), ...spec.links });
    return { ...data, id: demoActivityIds[index], created_by: ownerId, contact_id: data.contact_id || null, opportunity_id: data.opportunity_id || null, meeting_id: data.meeting_id || null, occurred_at: data.occurred_at || null };
  });
}
