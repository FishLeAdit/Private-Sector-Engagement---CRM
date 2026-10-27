import Link from "next/link";
import { normalizePhone } from "@/features/contacts/schemas";
import type { ContactHistory, ContactRecord } from "@/features/contacts/types";
import { formatDate } from "@/lib/dates";
import { money } from "@/lib/money";

// Sections of the contact detail page.

function Detail({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-base-content/60">{label}</dt>
      <dd className={className ? `mt-1 ${className}` : "mt-1"}>{children}</dd>
    </div>
  );
}

export function ContactInformation({ contact }: { contact: ContactRecord }) {
  return (
    <section className="rounded-xl border border-base-300 bg-base-100 p-6">
      <h2 className="mb-5 text-lg font-semibold">Contact information</h2>
      <dl className="space-y-4 text-sm">
        <Detail label="Email" className="break-all">
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="link">
              {contact.email}
            </a>
          ) : (
            "Not provided"
          )}
        </Detail>
        <Detail label="Phone">
          {contact.phone ? (
            <a href={`tel:${normalizePhone(contact.phone)}`} className="link">
              {contact.phone}
            </a>
          ) : (
            "Not provided"
          )}
        </Detail>
        <Detail label="Company / workplace">
          {contact.company ? (
            <Link href={`/contacts/${contact.company.id}`} className="link">
              {contact.company.name}
            </Link>
          ) : (
            "Not linked"
          )}
        </Detail>
        <Detail label="Website" className="break-all">
          {contact.website ? (
            <a href={contact.website} target="_blank" rel="noreferrer" className="link">
              {contact.website}
            </a>
          ) : (
            "Not provided"
          )}
        </Detail>
        <Detail label="Industry">{contact.industry || "Not provided"}</Detail>
        <Detail label="Owner">{contact.creator?.display_name ?? "PSE team"}</Detail>
        <Detail label="Created / updated">
          {formatDate(contact.created_at)} / {formatDate(contact.updated_at)}
        </Detail>
      </dl>
      {contact.kind === "company" && (
        <Link href={`/contacts?company_id=${contact.id}`} className="btn btn-ghost btn-sm mt-5">
          View associated people
        </Link>
      )}
    </section>
  );
}

function RecentList({
  title,
  note,
  empty,
  children,
}: {
  title: string;
  note: string;
  empty: string | false;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-base-300 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-base-content/60">{note}</p>
      <ul className="mt-4 space-y-4">{children}</ul>
      {empty && <p className="mt-4 text-sm text-base-content/60">{empty}</p>}
    </section>
  );
}

// Recent records only, including those linked indirectly through the deals and meetings shown.
export function ContactHistoryLists({ history }: { history: ContactHistory }) {
  return (
    <div className="mt-7 grid gap-6 xl:grid-cols-3">
      <RecentList
        title="Recent opportunities"
        note="Latest 10 records linked to this contact or point of contact."
        empty={!history.opportunities.length && "No linked opportunities yet."}
      >
        {history.opportunities.map(row => (
          <li key={row.id}>
            <Link href={`/opportunities/${row.id}`} className="link link-hover font-medium">
              {row.deal_name}
            </Link>
            <p className="mt-1 text-sm text-base-content/65">{money(row.expected_amount, row.currency)} expected</p>
          </li>
        ))}
      </RecentList>
      <RecentList
        title="Recent meetings"
        note="Latest 10 direct links and links through the opportunities shown."
        empty={!history.meetings.length && "No linked meetings yet."}
      >
        {history.meetings.map(row => (
          <li key={row.id}>
            <Link href={`/meetings/${row.id}`} className="link link-hover font-medium">
              {row.title}
            </Link>
            <p className="mt-1 text-sm capitalize text-base-content/65">
              {row.status} · {formatDate(row.scheduled_at, true)}
            </p>
          </li>
        ))}
      </RecentList>
      <RecentList
        title="Activity history"
        note="Latest 20 direct links and links through the records shown."
        empty={!history.activities.length && "No linked activities yet."}
      >
        {history.activities.map(row => (
          <li key={row.id}>
            <Link href={`/activities/${row.id}`} className="link link-hover font-medium capitalize">
              {row.activity_type.replaceAll("_", " ")}
            </Link>
            <p className="mt-1 text-sm text-base-content/65">
              {row.status.replaceAll("_", " ")} · {formatDate(row.occurred_at ?? row.created_at)}
            </p>
            {row.notes && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{row.notes}</p>}
          </li>
        ))}
      </RecentList>
    </div>
  );
}
