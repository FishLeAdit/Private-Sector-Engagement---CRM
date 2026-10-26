import Link from "next/link";
import { notFound } from "next/navigation";
import { contactPageContext, contactPageData } from "@/features/contacts/context";
import { canEditContact } from "@/features/contacts/service";
import { normalizePhone } from "@/features/contacts/schemas";
import { ContactProblem } from "@/components/contacts/contact-state";
import { DeleteContactButton } from "@/components/contacts/delete-contact-button";
import { formatDate } from "@/lib/dates";

export default async function ContactDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { service, access } = await contactPageContext();
  const saved = (await searchParams).saved;
    const id = (await params).id;
    const result = await contactPageData(() => service.details(id));
    if (!result.ok) {
      if ([400, 404].includes(result.error.status)) notFound();
      return <ContactProblem message={result.error.message} />;
    }
    const { contact, history } = result.data;
    return <>
      <Link href="/contacts" className="link link-hover text-sm text-base-content/65">← Contacts</Link>
      <div className="mb-7 mt-4 flex flex-wrap items-start justify-between gap-4"><div><span className="badge badge-ghost mb-2 capitalize">{contact.kind}</span><h1 className="break-words text-3xl font-bold">{contact.name}</h1>{contact.designation && <p className="mt-2 text-base-content/65">{contact.designation}</p>}</div>
        {canEditContact(access, contact) && <div className="flex flex-wrap gap-2"><Link href={`/contacts/${contact.id}/edit`} className="btn btn-outline">Edit contact</Link><DeleteContactButton contactId={contact.id} name={contact.name} /></div>}
      </div>
      {["created", "updated"].includes(saved ?? "") && <p role="status" className="mb-6 rounded-lg bg-success/10 p-4 text-success">Contact {saved === "created" ? "created" : "updated"} successfully.</p>}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <section className="rounded-xl border border-base-300 bg-base-100 p-6"><h2 className="mb-5 text-lg font-semibold">Contact information</h2>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-base-content/60">Email</dt><dd className="mt-1 break-all">{contact.email ? <a href={`mailto:${contact.email}`} className="link">{contact.email}</a> : "Not provided"}</dd></div>
            <div><dt className="text-base-content/60">Phone</dt><dd className="mt-1">{contact.phone ? <a href={`tel:${normalizePhone(contact.phone)}`} className="link">{contact.phone}</a> : "Not provided"}</dd></div>
            <div><dt className="text-base-content/60">Company / workplace</dt><dd className="mt-1">{contact.company ? <Link href={`/contacts/${contact.company.id}`} className="link">{contact.company.name}</Link> : "Not linked"}</dd></div>
            <div><dt className="text-base-content/60">Website</dt><dd className="mt-1 break-all">{contact.website ? <a href={contact.website} target="_blank" rel="noreferrer" className="link">{contact.website}</a> : "Not provided"}</dd></div>
            <div><dt className="text-base-content/60">Industry</dt><dd className="mt-1">{contact.industry || "Not provided"}</dd></div>
            <div><dt className="text-base-content/60">Owner</dt><dd className="mt-1">{contact.creator?.display_name ?? "PSE team"}</dd></div>
            <div><dt className="text-base-content/60">Created / updated</dt><dd className="mt-1">{formatDate(contact.created_at)} / {formatDate(contact.updated_at)}</dd></div>
          </dl>
          {contact.kind === "company" && <Link href={`/contacts?company_id=${contact.id}`} className="btn btn-ghost btn-sm mt-5">View associated people</Link>}
        </section>
        <section className="rounded-xl border border-base-300 bg-base-100 p-6"><h2 className="mb-4 text-lg font-semibold">Relationship notes</h2><p className="whitespace-pre-wrap break-words text-sm leading-7">{contact.notes || "No relationship notes yet."}</p></section>
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-base-300 p-5"><h2 className="text-lg font-semibold">Recent opportunities</h2><p className="mt-1 text-xs text-base-content/60">Latest 10 records linked to this contact or point of contact.</p>
          <ul className="mt-4 space-y-4">{history.opportunities.map(row => <li key={row.id}><Link href={`/opportunities/${row.id}`} className="link link-hover font-medium">{row.deal_name}</Link><p className="mt-1 text-sm text-base-content/65">{new Intl.NumberFormat("en-BD", { style: "currency", currency: row.currency }).format(row.expected_amount)} expected</p></li>)}</ul>{!history.opportunities.length && <p className="mt-4 text-sm text-base-content/60">No linked opportunities yet.</p>}
        </section>
        <section className="rounded-xl border border-base-300 p-5"><h2 className="text-lg font-semibold">Recent meetings</h2><p className="mt-1 text-xs text-base-content/60">Latest 10 direct links and links through the opportunities shown.</p>
          <ul className="mt-4 space-y-4">{history.meetings.map(row => <li key={row.id}><Link href={`/meetings/${row.id}`} className="link link-hover font-medium">{row.title}</Link><p className="mt-1 text-sm capitalize text-base-content/65">{row.status} · {formatDate(row.scheduled_at, true)}</p></li>)}</ul>{!history.meetings.length && <p className="mt-4 text-sm text-base-content/60">No linked meetings yet.</p>}
        </section>
        <section className="rounded-xl border border-base-300 p-5"><h2 className="text-lg font-semibold">Activity history</h2><p className="mt-1 text-xs text-base-content/60">Latest 20 direct links and links through the records shown.</p>
          <ul className="mt-4 space-y-4">{history.activities.map(row => <li key={row.id}><Link href={`/activities/${row.id}`} className="link link-hover font-medium capitalize">{row.activity_type.replaceAll("_", " ")}</Link><p className="mt-1 text-sm text-base-content/65">{row.status.replaceAll("_", " ")} · {formatDate(row.occurred_at ?? row.created_at)}</p>{row.notes && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{row.notes}</p>}</li>)}</ul>{!history.activities.length && <p className="mt-4 text-sm text-base-content/60">No linked activities yet.</p>}
        </section>
      </div>
      <p className="mt-5 text-xs text-base-content/60">Dates are displayed in Asia/Dhaka. Related workflow screens are being developed separately.</p>
    </>;
}
