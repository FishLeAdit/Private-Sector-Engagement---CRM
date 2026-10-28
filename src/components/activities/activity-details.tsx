import Link from "next/link";
import { workCategoryLabels, workCategories } from "@/features/activities/schemas";
import type { ActivityRecord } from "@/features/activities/types";
import { MeetingContactInformation } from "@/components/meetings/contact-information";
import { formatDate } from "@/lib/dates";
import { ActivityStatus } from "./activity-controls";

// Sections of the activity detail page.

export function ActivityWorkDetails({ row, editable }: { row: ActivityRecord; editable: boolean }) {
  return (
    <section className="space-y-5 panel p-6">
      <h2 className="text-lg font-semibold">Work details</h2>
      <dl className="grid gap-5 text-sm sm:grid-cols-2">
        {[
          ["Owner", row.owner?.display_name ?? "Former owner"],
          ["Created by", row.creator?.display_name ?? "Former creator"],
          ["Work category", workCategoryLabels[row.work_category as (typeof workCategories)[number]]],
          ["Relevant date/time (Dhaka)", row.occurred_at ? formatDate(row.occurred_at, true) : "Not recorded"],
          ["Related person", row.related_person_name || "Not provided"],
          ["Related organization", row.related_organization_name || "Not provided"],
        ].map(([name, value]) => (
          <div key={name}>
            <dt className="text-base-content/60">{name}</dt>
            <dd className="mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Notes / context</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{row.notes || "No notes recorded."}</p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Remaining work</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">
          {row.remaining_work || "No remaining work recorded."}
        </p>
      </div>
      {editable && <ActivityStatus key={`${row.id}:${row.status}`} id={row.id} status={row.status} />}
      <p className="text-xs text-base-content/60">
        Completion changes work status only. It does not record fundraising achievement or change the relevant event
        time.
      </p>
    </section>
  );
}

// Direct links, plus the deal and contact reached through a linked meeting.
export function ActivityLinkedRecords({ row }: { row: ActivityRecord }) {
  const effectiveOpportunity = row.opportunity ?? row.meeting?.opportunity ?? null;
  const contact = row.contact ?? row.meeting?.contact ?? null;
  return (
    <section className="space-y-5 panel p-6">
      <h2 className="text-lg font-semibold">Linked records</h2>
      {row.meeting && (
        <p className="text-sm">
          Meeting:{" "}
          <Link href={`/meetings/${row.meeting.id}`} className="link">
            {row.meeting.title}
          </Link>
        </p>
      )}
      {effectiveOpportunity && (
        <p className="text-sm">
          Opportunity:{" "}
          <Link href={`/opportunities/${effectiveOpportunity.id}`} className="link">
            {effectiveOpportunity.deal_name}
          </Link>
          {!row.opportunity_id && " (through meeting)"}
        </p>
      )}
      {contact || effectiveOpportunity ? (
        <MeetingContactInformation contact={contact} opportunity={effectiveOpportunity} />
      ) : (
        <p className="text-sm text-base-content/65">Independent activity with no linked CRM record.</p>
      )}
      {!row.contact_id && (contact || effectiveOpportunity) && (
        <p className="text-xs text-base-content/60">
          Contact information is derived from linked records. Text context remains separate from contact identity.
        </p>
      )}
      <h3 className="text-sm font-semibold">Document references</h3>
      <ul className="space-y-2 text-sm">
        {row.drive_urls.map((url, index) => (
          <li key={`${index}:${url}`}>
            <a href={url} target="_blank" rel="noreferrer" className="link break-all">
              {url}
            </a>
          </li>
        ))}
      </ul>
      {!row.drive_urls.length && (
        <p className="text-sm text-base-content/65">
          No separate document URLs. References may also be recorded in Notes.
        </p>
      )}
    </section>
  );
}
