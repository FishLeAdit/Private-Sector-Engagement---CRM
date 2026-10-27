import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";

export function DeleteContactButton({ contactId, name }: { contactId: string; name: string }) {
  return (
    <ConfirmDeleteButton
      noun="contact"
      name={name}
      endpoint={`/api/contacts/${contactId}`}
      redirectTo="/contacts?deleted=1"
      consequences="This permanently removes the contact. Audit history is retained. Linked records must be reassigned or unlinked before deletion."
    />
  );
}
