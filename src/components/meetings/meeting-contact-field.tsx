"use client";
import Link from "next/link";
import { Controller, type Control } from "react-hook-form";
import type { MeetingFormInput, MeetingInput } from "@/features/meetings/schemas";
import type { MeetingContact, MeetingOpportunity } from "@/features/meetings/types";
import { ContactPicker } from "@/components/opportunities/contact-picker";
import { opportunityContacts } from "./contact-choices";

type Props = {
  control: Control<MeetingFormInput, unknown, MeetingInput>;
  opportunity: MeetingOpportunity | null;
  contact: MeetingContact | null;
  onSelect: (contact: MeetingContact | null) => void;
  disabled: boolean;
  error: React.ReactNode;
};

// Without a deal, any internal contact can be searched. With a deal selected, the contact must be one of
// that deal's own contact people, or left empty to use the deal's contact details.
export function MeetingContactField({ control, opportunity, contact, onSelect, disabled, error }: Props) {
  const choices = opportunity ? opportunityContacts(opportunity) : [];
  return (
    <div>
      {opportunity ? (
        <Controller
          name="contact_id"
          control={control}
          render={({ field }) => (
            <>
              <label htmlFor="meeting-contact" className="mb-2 block text-sm font-medium">
                Contact person / organization
              </label>
              <select
                id="meeting-contact"
                className="select select-bordered w-full"
                value={field.value ?? ""}
                onChange={event => onSelect(choices.find(row => row.id === event.target.value) ?? null)}
                onBlur={field.onBlur}
                ref={field.ref}
              >
                <option value="">Use opportunity contact details</option>
                {choices.map(row => (
                  <option key={row.id} value={row.id}>
                    {row.name} ({row.kind})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-base-content/60">
                An explicit contact must be the opportunity’s party, primary or secondary contact.
              </p>
            </>
          )}
        />
      ) : (
        <Controller
          name="contact_id"
          control={control}
          render={({ field }) => (
            <ContactPicker<MeetingContact>
              value={field.value ?? ""}
              selected={contact}
              onSelect={onSelect}
              label="Contact person / organization"
              disabled={disabled}
              emptyMessage="No contacts found. Create one in Contacts, then search again."
            />
          )}
        />
      )}
      {error}
      <Link href="/contacts/new" target="_blank" className="link mt-2 inline-block text-xs">
        Create a contact in a new tab
      </Link>
    </div>
  );
}
