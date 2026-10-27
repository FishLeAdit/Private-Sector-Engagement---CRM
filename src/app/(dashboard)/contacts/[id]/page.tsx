import Link from "next/link";
import { notFound } from "next/navigation";
import { contactPageContext, contactPageData } from "@/features/contacts/context";
import { canEditContact } from "@/features/contacts/service";
import { ContactProblem } from "@/components/contacts/contact-state";
import { ContactHistoryLists, ContactInformation } from "@/components/contacts/contact-details";
import { DeleteContactButton } from "@/components/contacts/delete-contact-button";
import { SavedNotice } from "@/components/ui/page";

export default async function ContactDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { service, access } = await contactPageContext();
  const saved = (await searchParams).saved;
  const id = (await params).id;
  const result = await contactPageData(() => service.details(id));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <ContactProblem message={result.error.message} />;
  }
  const { contact, history } = result.data;
  return (
    <>
      <Link href="/contacts" className="link link-hover text-sm text-base-content/65">
        ← Contacts
      </Link>
      <div className="mb-7 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-ghost mb-2 capitalize">{contact.kind}</span>
          <h1 className="break-words text-3xl font-bold">{contact.name}</h1>
          {contact.designation && <p className="mt-2 text-base-content/65">{contact.designation}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/activities/new?contact_id=${contact.id}`} className="btn btn-outline">
            Log activity
          </Link>
          <Link href={`/activities?contact_id=${contact.id}`} className="btn btn-ghost">
            View direct activities
          </Link>
          <Link href={`/meetings/new?contact_id=${contact.id}`} className="btn btn-primary">
            Schedule meeting
          </Link>
          {canEditContact(access, contact) && (
            <>
              <Link href={`/contacts/${contact.id}/edit`} className="btn btn-outline">
                Edit contact
              </Link>
              <DeleteContactButton contactId={contact.id} name={contact.name} />
            </>
          )}
        </div>
      </div>
      <SavedNotice saved={saved} noun="Contact" />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <ContactInformation contact={contact} />
        <section className="rounded-xl border border-base-300 bg-base-100 p-6">
          <h2 className="mb-4 text-lg font-semibold">Relationship notes</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            {contact.notes || "No relationship notes yet."}
          </p>
        </section>
      </div>
      <ContactHistoryLists history={history} />
      <p className="mt-5 text-xs text-base-content/60">
        Dates are displayed in Asia/Dhaka. Related history is limited to the recent records shown.
      </p>
    </>
  );
}
