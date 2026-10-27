import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";

export function DeleteOpportunityButton({ opportunityId, name }: { opportunityId: string; name: string }) {
  return (
    <ConfirmDeleteButton
      noun="opportunity"
      name={name}
      endpoint={`/api/opportunities/${opportunityId}`}
      redirectTo="/opportunities?deleted=1"
      consequences="This permanently removes the opportunity. Audit history is retained. Opportunities with linked meetings, activities or recognized contributions cannot be deleted. Contacts are kept."
    />
  );
}
