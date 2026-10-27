"use client";
import { useEffect, useRef } from "react";
import type { Party } from "@/features/opportunities/types";
import type { ContactRecord } from "@/features/contacts/types";
import { emptyContact } from "@/features/contacts/schemas";
import { ContactForm } from "@/components/contacts/contact-form";

export type ContactField = "contact_id" | "primary_contact_id" | "secondary_contact_id";

// Creates a contact without leaving the deal form. Each request has a new key, which mounts a fresh
// ContactForm. Company contact people are created as individuals already linked to the deal's company.
export function InlineContactDialog({
  request,
  company,
  onSaved,
}: {
  request: { field: ContactField; key: number };
  company: Party | null;
  onSaved: (field: ContactField, contact: ContactRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Open after the fresh contact form mounts, so native dialog focus targets it.
  useEffect(() => {
    if (request.key) dialog.current?.showModal();
  }, [request.key]);
  const forCompany = request.field !== "contact_id";
  return (
    <dialog ref={dialog} className="modal" aria-labelledby="inline-contact-title">
      <div className="modal-box max-w-3xl">
        <h2 id="inline-contact-title" className="mb-3 text-xl font-bold">
          Create a contact for this deal
        </h2>
        <p className="mb-5 text-sm text-base-content/65">
          Saving creates a contact immediately, even if you later cancel the deal. Your deal draft stays open.
        </p>
        <ContactForm
          key={request.key}
          fixedKind={forCompany ? "individual" : undefined}
          company={forCompany && company ? company : null}
          initial={{ ...emptyContact, company_id: forCompany ? (company?.id ?? "") : "" }}
          onSaved={contact => {
            onSaved(request.field, contact);
            dialog.current?.close();
          }}
          onCancel={() => dialog.current?.close()}
        />
      </div>
    </dialog>
  );
}
