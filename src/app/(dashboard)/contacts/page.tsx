import Link from "next/link";
import { redirect } from "next/navigation";
import { contactPageContext, contactPageData } from "@/features/contacts/context";
import { CONTACT_PAGE_SIZE, contactListSchema } from "@/features/contacts/schemas";
import { ContactFilters } from "@/components/contacts/contact-filters";
import { ContactProblem } from "@/components/contacts/contact-state";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { service } = await contactPageContext();
  const { deleted, ...filters } = await searchParams;
  const parsed = contactListSchema.safeParse(filters);
  if (!parsed.success) return <ContactProblem message={parsed.error.issues[0]?.message ?? "Choose valid search filters."} />;
  const input = parsed.data;
    const result = await contactPageData(() => Promise.all([service.list(input), input.company_id ? service.get(input.company_id) : null]));
    if (!result.ok) return <ContactProblem message={result.error.message} />;
    const [{ contacts, count }, company] = result.data;
    const pages = Math.max(1, Math.ceil(count / CONTACT_PAGE_SIZE));
    const pageLink = (page: number) => `/contacts?${new URLSearchParams({ q: input.q, kind: input.kind, company_id: input.company_id, page: String(page) })}`;
    if (input.page > pages) redirect(pageLink(pages));
    return <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Contacts</h1><p className="mt-2 text-base-content/65">People, companies and the relationships behind your work.</p></div><Link href="/contacts/new" className="btn btn-primary">New contact</Link></div>
      {deleted === "1" && <p className="mb-5 rounded-lg bg-success/10 p-4 text-success" role="status">Contact deleted successfully.</p>}
      <ContactFilters key={`${input.q}:${input.kind}:${input.company_id}`} input={input} company={company} />
      <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
        {contacts.length ? <table className="table"><caption className="sr-only">Contacts matching the selected search and filters</caption>
          <thead><tr><th>Name</th><th>Type</th><th>Email / phone</th><th>Company / industry</th><th>Owner</th></tr></thead>
          <tbody>{contacts.map(contact => <tr key={contact.id} className="hover:bg-base-200/50">
            <td><Link href={`/contacts/${contact.id}`} className="link link-hover font-semibold">{contact.name}</Link>{contact.designation && <p className="mt-1 text-xs text-base-content/60">{contact.designation}</p>}</td>
            <td><span className="badge badge-ghost capitalize">{contact.kind}</span></td>
            <td><div className="space-y-1">{contact.email && <p className="break-all">{contact.email}</p>}{contact.phone && <p className="whitespace-nowrap text-base-content/70">{contact.phone}</p>}</div></td>
            <td>{contact.company ? <Link href={`/contacts/${contact.company.id}`} className="link link-hover">{contact.company.name}</Link> : contact.industry || "—"}</td>
            <td>{contact.creator?.display_name ?? "PSE team"}</td>
          </tr>)}</tbody>
        </table> : <div className="space-y-3 p-10 text-center"><h2 className="text-xl font-semibold">{input.q || input.kind !== "all" || input.company_id ? "No matching contacts" : "Your contacts start here"}</h2><p className="text-base-content/65">{input.q || input.kind !== "all" || input.company_id ? "Try another search or reset the filters." : "Create an individual or company contact to begin building your network."}</p><Link href={input.q || input.kind !== "all" || input.company_id ? "/contacts" : "/contacts/new"} className="btn btn-outline">{input.q || input.kind !== "all" || input.company_id ? "Reset filters" : "Create contact"}</Link></div>}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-base-content/65">{count} {count === 1 ? "contact" : "contacts"} · Page {input.page} of {pages}</p>
        <nav aria-label="Contact pages" className="flex gap-2">{input.page > 1 && <Link href={pageLink(input.page - 1)} className="btn btn-outline btn-sm">Previous</Link>}{input.page < pages && <Link href={pageLink(input.page + 1)} className="btn btn-outline btn-sm">Next</Link>}</nav>
      </div>
    </>;
}
