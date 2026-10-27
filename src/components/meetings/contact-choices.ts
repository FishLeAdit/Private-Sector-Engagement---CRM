// A deal's contact people: its party plus primary and secondary contacts, without duplicates.
// Meetings and activities may link directly only to one of these when a deal is selected.

type Linked<C> = {
  contact_id: string;
  primary_contact_id: string | null;
  secondary_contact_id: string | null;
  contact: C | null;
  primary_contact: C | null;
  secondary_contact: C | null;
};

export function opportunityContacts<C extends { id: string }>(opportunity: Linked<C>): C[] {
  return [opportunity.contact, opportunity.primary_contact, opportunity.secondary_contact]
    .filter((row): row is C => !!row)
    .filter((row, index, rows) => rows.findIndex(other => other.id === row.id) === index);
}

export function belongsToOpportunity<C>(opportunity: Linked<C>, contactId: string) {
  return [opportunity.contact_id, opportunity.primary_contact_id, opportunity.secondary_contact_id].includes(contactId);
}
