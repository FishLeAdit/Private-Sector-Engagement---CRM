import Link from "next/link";
import { notFound } from "next/navigation";
import { contactPageContext, contactPageData } from "@/features/contacts/context";
import { canEditContact } from "@/features/contacts/service";
import type { ContactInput } from "@/features/contacts/schemas";
import { ContactForm } from "@/components/contacts/contact-form";
import { ContactProblem } from "@/components/contacts/contact-state";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { service, access } = await contactPageContext();
    const id = (await params).id;
    const result = await contactPageData(() => service.get(id));
    if (!result.ok) {
      if ([400, 404].includes(result.error.status)) notFound();
      return <ContactProblem message={result.error.message} />;
    }
    const contact = result.data;
    if (!canEditContact(access, contact)) return <section className="space-y-4"><h1 className="text-2xl font-bold">Editing is restricted</h1><p>Only the creator or an authorized manager may edit this contact.</p><Link href={`/contacts/${contact.id}`} className="btn btn-outline">View contact</Link></section>;
    const initial: ContactInput = { kind: contact.kind as ContactInput["kind"], name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "", company_id: contact.company_id ?? "", designation: contact.designation ?? "", website: contact.website ?? "", industry: contact.industry ?? "", notes: contact.notes ?? "" };
    return <><Link href={`/contacts/${contact.id}`} className="link link-hover text-sm text-base-content/65">← {contact.name}</Link><h1 className="mb-7 mt-4 text-3xl font-bold">Edit contact</h1><ContactForm contactId={contact.id} initial={initial} company={contact.company} /></>;
}
