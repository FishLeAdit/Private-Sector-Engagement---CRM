import type { Tables, TablesInsert } from "../../src/types/database.types";
import { meetingSchema } from "../../src/features/meetings/schemas";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "../../src/lib/dates";
import { DEMO_MARKER } from "./demo-data";
export const demoMeetingIds = Array.from({ length: 6 }, (_, index) => `d3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
type Contact = Pick<Tables<"contacts">, "id" | "kind">;
type Opportunity = Pick<Tables<"opportunities">, "id" | "contact_id" | "primary_contact_id" | "secondary_contact_id">;
export function buildDemoMeetings(ownerId: string, contacts: Contact[], opportunities: Opportunity[], now = new Date()): TablesInsert<"meetings">[] {
  if (!contacts.length) throw new Error("Existing demo contacts are required. Preview seed:demo first; this meeting seed does not recreate deleted contacts or opportunities.");
  const baseDay = toDhakaDateTimeInput(now.toISOString()).slice(0, 10);
  const date = (offset: number, time: string) => {
    const day = new Date(`${baseDay}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + offset);
    return fromDhakaDateTimeInput(`${day.toISOString().slice(0, 10)}T${time}`);
  };
  const independent = contacts.filter(row => row.kind === "individual"), person = independent[0] ?? contacts[0], other = independent[1] ?? person;
  const first = opportunities[0], second = opportunities[1] ?? first, third = opportunities[2] ?? first;
  const explicit = (opportunity?: Opportunity) => opportunity ? { contact_id: opportunity.primary_contact_id ?? opportunity.contact_id, opportunity_id: opportunity.id } : { contact_id: person.id };
  const specifications = [
    { title: "Sponsorship discussion", days: 1, time: "10:00", status: "scheduled", links: explicit(first), description: "Review the sponsorship proposal and agree next steps." },
    { title: "Independent donor introduction", days: 3, time: "14:30", status: "scheduled", links: { contact_id: person.id }, description: "Contact-only conversation; no financial opportunity is required." },
    { title: "Equipment planning conversation", days: 5, time: "11:00", status: "scheduled", links: second ? { opportunity_id: second.id } : { contact_id: person.id }, description: "Opportunity-linked discussion. Contact information derives from the saved opportunity when no explicit person is selected." },
    { title: "Partnership review", days: -2, time: "15:00", status: "done", links: explicit(third), description: "Completed discussion. Meeting completion does not recognize received funding." },
    { title: "Stewardship check-in", days: -7, time: "10:30", status: "done", links: { contact_id: other.id }, description: "Completed contact-only relationship conversation. Record any next action as a linked follow-up task." },
    { title: "Planning conversation", days: 2, time: "16:00", status: "cancelled", links: { contact_id: person.id }, description: "Cancelled example. Cancelled is an additional project status alongside Scheduled and Done." },
  ];
  return specifications.map((value, index) => {
    const row = { title: `Demo | ${value.title}`, scheduled_at: date(value.days, value.time), status: value.status, owner_id: ownerId, description: `${DEMO_MARKER}. ${value.description}`, ...value.links };
    meetingSchema.parse(row);
    return { ...row, id: demoMeetingIds[index], created_by: ownerId };
  });
}
