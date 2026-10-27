"use client";
import { useState } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import type { OpportunityFormInput, OpportunityInput } from "@/features/opportunities/schemas";
import type { Party } from "@/features/opportunities/types";
import { ContactPicker } from "./contact-picker";
import type { ContactField } from "./inline-contact-dialog";

const contactLabels: Record<ContactField, string> = {
  contact_id: "Individual / company",
  primary_contact_id: "Primary contact",
  secondary_contact_id: "Secondary contact (optional)",
};
const createLabels: Record<ContactField, string> = {
  contact_id: "contact",
  primary_contact_id: "primary contact",
  secondary_contact_id: "secondary contact",
};

// The deal's party (individual or company) and, for companies, its primary and secondary contact people.
export function useDealContacts(
  initial: Partial<Record<ContactField, Party | null>>,
  setValue: UseFormSetValue<OpportunityFormInput>,
) {
  const [selected, setSelected] = useState(initial);
  const [creation, setCreation] = useState<{ field: ContactField; key: number }>({ field: "contact_id", key: 0 });
  const company = selected.contact_id?.kind === "company" ? selected.contact_id : null;

  // Changing the party clears both contact people, since they belonged to the previous company.
  function select(field: ContactField, party: Party | null) {
    setSelected(current => ({
      ...current,
      [field]: party,
      ...(field === "contact_id" ? { primary_contact_id: null, secondary_contact_id: null } : {}),
    }));
    setValue(field, party?.id ?? "", { shouldValidate: true, shouldDirty: true });
    if (field === "contact_id") {
      setValue("primary_contact_id", "");
      setValue("secondary_contact_id", "");
    }
  }
  const requestCreate = (field: ContactField) => setCreation(current => ({ field, key: current.key + 1 }));

  return { selected, company, select, creation, requestCreate };
}

export function DealContactField({
  field,
  contacts,
  control,
  disabled,
  error,
}: {
  field: ContactField;
  contacts: ReturnType<typeof useDealContacts>;
  control: Control<OpportunityFormInput, unknown, OpportunityInput>;
  disabled: boolean;
  error: React.ReactNode;
}) {
  return (
    <div>
      <Controller
        name={field}
        control={control}
        render={({ field: value }) => (
          <ContactPicker
            value={value.value ?? ""}
            selected={contacts.selected[field] ?? null}
            onSelect={party => contacts.select(field, party)}
            label={contactLabels[field]}
            individual={field !== "contact_id"}
            disabled={disabled}
          />
        )}
      />
      {error}
      <button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => contacts.requestCreate(field)}>
        Create {createLabels[field]}
      </button>
    </div>
  );
}
