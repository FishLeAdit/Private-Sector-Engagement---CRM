import Link from "next/link";
import type { MeetingContact, MeetingOpportunity } from "@/features/meetings/types";
export function meetingContact(contact: MeetingContact | null, opportunity: MeetingOpportunity | null) {
  return contact ?? opportunity?.primary_contact ?? opportunity?.contact ?? null;
}
export function MeetingContactInformation({
  contact,
  opportunity,
}: {
  contact: MeetingContact | null;
  opportunity: MeetingOpportunity | null;
}) {
  const person = meetingContact(contact, opportunity);
  const opportunityCompany = opportunity?.contact?.kind === "company" ? opportunity.contact : null;
  const company = opportunityCompany ?? (person?.kind === "company" ? person : (person?.company ?? null));
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-base-content/60">Contact person / organization</dt>
        <dd className="mt-1">
          {person ? (
            <Link href={`/contacts/${person.id}`} className="link">
              {person.name}
            </Link>
          ) : (
            "Not available"
          )}
        </dd>
      </div>
      <div>
        <dt className="text-base-content/60">{opportunityCompany ? "Opportunity organization" : "Organization"}</dt>
        <dd className="mt-1">
          {company ? (
            <Link href={`/contacts/${company.id}`} className="link">
              {company.name}
            </Link>
          ) : (
            "Not linked"
          )}
        </dd>
      </div>
      {person?.company && person.company.id !== company?.id && (
        <div>
          <dt className="text-base-content/60">Contact’s workplace</dt>
          <dd className="mt-1">
            <Link href={`/contacts/${person.company.id}`} className="link">
              {person.company.name}
            </Link>
          </dd>
        </div>
      )}
      <div>
        <dt className="text-base-content/60">Designation</dt>
        <dd className="mt-1">{person?.designation || "Not provided"}</dd>
      </div>
      <div>
        <dt className="text-base-content/60">Email / phone</dt>
        <dd className="mt-1 break-all">
          {[person?.email, person?.phone].filter(Boolean).join(" · ") || "Not provided"}
        </dd>
      </div>
    </dl>
  );
}
