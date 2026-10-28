import Link from "next/link";
import { contactPageContext } from "@/features/contacts/context";
import { emptyContact } from "@/features/contacts/schemas";
import { ContactForm } from "@/components/contacts/contact-form";
import { SysCode } from "@/components/ui/hud";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await contactPageContext();
  const kind = (await searchParams).kind === "company" ? "company" : "individual";
  return (
    <>
      <Link href="/contacts" className="link link-hover text-sm text-base-content/65">
        ← Contacts
      </Link>
      <div className="mb-7 mt-4">
        <SysCode className="mb-1 block">{"SYS.CON // NEW"}</SysCode>
        <h1 className="text-3xl font-bold">New contact</h1>
        <p className="mt-2 text-base-content/65">
          Add a person or company. You can build their relationship history over time.
        </p>
      </div>
      <ContactForm initial={{ ...emptyContact, kind }} />
    </>
  );
}
