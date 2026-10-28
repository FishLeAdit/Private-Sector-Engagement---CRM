import Link from "next/link";
import { redirect } from "next/navigation";
import { contactPageContext, contactPageData } from "@/features/contacts/context";
import { CONTACT_PAGE_SIZE, contactListSchema } from "@/features/contacts/schemas";
import { ContactFilters } from "@/components/contacts/contact-filters";
import { ContactProblem } from "@/components/contacts/contact-state";
import { ListHeader, StatusNotice } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { listHref, pageCount } from "@/lib/list-href";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await contactPageContext();
  const { deleted, ...filters } = await searchParams;
  const parsed = contactListSchema.safeParse(filters);
  if (!parsed.success)
    return <ContactProblem message={parsed.error.issues[0]?.message ?? "Choose valid search filters."} />;
  const input = parsed.data;
  const result = await contactPageData(() =>
    Promise.all([service.list(input), input.company_id ? service.get(input.company_id) : null]),
  );
  if (!result.ok) return <ContactProblem message={result.error.message} />;
  const [{ contacts, count }, company] = result.data;
  const pages = pageCount(count, CONTACT_PAGE_SIZE);
  const pageLink = (page: number) =>
    listHref("/contacts", { q: input.q, kind: input.kind, company_id: input.company_id }, page);
  if (input.page > pages) redirect(pageLink(pages));
  return (
    <>
      <ListHeader
        code={`SYS.CON // ${count} ${count === 1 ? "RECORD" : "RECORDS"}`}
        title="Contacts"
        description="People, companies and the relationships behind your work."
      >
        <Link href="/contacts/new" className="btn btn-primary">
          New contact
        </Link>
      </ListHeader>
      {deleted === "1" && <StatusNotice>Contact deleted successfully.</StatusNotice>}
      <ContactFilters key={`${input.q}:${input.kind}:${input.company_id}`} input={input} company={company} />
      <div className="overflow-x-auto panel">
        {contacts.length ? (
          <table className="table">
            <caption className="sr-only">Contacts matching the selected search and filters</caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Email / phone</th>
                <th>Company / industry</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-base-200/50">
                  <td>
                    <Link href={`/contacts/${contact.id}`} className="link link-hover font-semibold">
                      {contact.name}
                    </Link>
                    {contact.designation && <p className="mt-1 text-xs text-base-content/60">{contact.designation}</p>}
                  </td>
                  <td>
                    <span className="badge badge-ghost badge-sm font-mono uppercase tracking-wider">
                      {contact.kind}
                    </span>
                  </td>
                  <td>
                    <div className="space-y-1">
                      {contact.email && <p className="break-all">{contact.email}</p>}
                      {contact.phone && <p className="whitespace-nowrap text-base-content/70">{contact.phone}</p>}
                    </div>
                  </td>
                  <td>
                    {contact.company ? (
                      <Link href={`/contacts/${contact.company.id}`} className="link link-hover">
                        {contact.company.name}
                      </Link>
                    ) : (
                      contact.industry || "—"
                    )}
                  </td>
                  <td>{contact.creator?.display_name ?? "PSE team"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-3 p-10 text-center">
            <h2 className="text-xl font-semibold">
              {input.q || input.kind !== "all" || input.company_id
                ? "No matching contacts"
                : "Your contacts start here"}
            </h2>
            <p className="text-base-content/65">
              {input.q || input.kind !== "all" || input.company_id
                ? "Try another search or reset the filters."
                : "Create an individual or company contact to begin building your network."}
            </p>
            <Link
              href={input.q || input.kind !== "all" || input.company_id ? "/contacts" : "/contacts/new"}
              className="btn btn-outline"
            >
              {input.q || input.kind !== "all" || input.company_id ? "Reset filters" : "Create contact"}
            </Link>
          </div>
        )}
      </div>
      <Pagination
        summary={`${count} ${count === 1 ? "contact" : "contacts"}`}
        page={input.page}
        pages={pages}
        label="Contact pages"
        href={pageLink}
      />
    </>
  );
}
